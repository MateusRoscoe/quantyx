# Automated Property Promotion System

## Context

Custom event properties are stored in flexible ClickHouse Map columns (`props_str`, `props_num`, `props_bool`). Querying Map keys is ~10x slower than dedicated columns because ClickHouse must read the entire Map for every row. The `property_metadata` materialized view already tracks every property name, type, and event count across all projects.

One known client will heavily use `idAccount` (a string prop) and needs fast slicing. Other clients and properties are unknown. We need a system that automatically detects high-traffic properties and promotes them to dedicated `MATERIALIZED` columns — no ingestion code changes, dramatic query speedup (2-25x per PostHog benchmarks), and fully reversible since the Map retains the original data.

## Architecture

A new standalone app `worker-property-promotion` that runs a periodic detection+promotion cycle:

1. Query `property_metadata` for properties exceeding a configurable event count threshold
2. Filter out already-promoted properties (tracked in a new `promoted_columns` table)
3. For each candidate: `ALTER TABLE ADD COLUMN mat_<name> <type> MATERIALIZED props_<type>['<name>']`
4. Backfill existing data: `ALTER TABLE MATERIALIZE COLUMN mat_<name>` (async on ClickHouse server)
5. Record the promotion in the tracking table

Manual promotion is supported via a `MANUAL_PROMOTIONS` env var (e.g., `idAccount:string`) processed on first cycle. Demotion is manual-only — never automatic, since dropping a column breaks queries referencing it.

## Changes

### 1. Create `infrastructure/clickhouse/init/02_promoted_columns.sql`

New tracking table for promoted columns:

```sql
CREATE TABLE IF NOT EXISTS analytics.promoted_columns (
    property_name String,
    property_type LowCardinality(String),
    column_name String,
    clickhouse_type LowCardinality(String),
    promoted_at DateTime DEFAULT now(),
    promotion_source LowCardinality(String) DEFAULT 'auto',
    event_count_at_promotion UInt64 DEFAULT 0,
    is_active UInt8 DEFAULT 1
) ENGINE = ReplacingMergeTree(promoted_at)
ORDER BY (property_name, property_type);
```

`ReplacingMergeTree` allows upsert — if a property is demoted and re-promoted, the latest row wins.

### 2. Scaffold `apps/worker-property-promotion/`

New app following the `consumer-events-ingest` pattern (esbuild, controller/service/model layers, Zod env, pino logging). **Not** a Fastify API — a long-running `setInterval` process.

**File structure:**

```
apps/worker-property-promotion/
  package.json              # Nx targets: build (esbuild), serve (@nx/js:node)
  tsconfig.json / tsconfig.app.json / tsconfig.spec.json
  vitest.config.ts
  eslint.config.mjs
  .env.example
  src/
    main.ts                 # Entry: AppCtrl.start(), or --promote for one-shot CLI
    helpers/
      env.ts                # Zod-validated env vars
      sanitize.ts           # Property name → safe column name (mat_<name>)
      sanitize.spec.ts
    models/
      clickhouse.ts         # All ClickHouse queries (candidates, promote, track)
      clickhouse.spec.ts
    services/
      detection-service.ts  # Queries property_metadata, filters already-promoted
      detection-service.spec.ts
      promotion-service.ts  # Orchestrates detect → promote → track cycle
      promotion-service.spec.ts
    controllers/
      app-ctrl.ts           # Starts setInterval loop, graceful shutdown
```

**Dependencies:** `@quantyx/clickhouse`, `@quantyx/shared-backend`

### 3. Implementation details

**`src/helpers/env.ts`** — Environment variables:

| Variable                              | Default   | Description                                                  |
| ------------------------------------- | --------- | ------------------------------------------------------------ |
| `PROMOTION_EVENT_COUNT_THRESHOLD`     | `10000`   | Min global event count to auto-promote                       |
| `PROMOTION_INTERVAL_SECONDS`          | `3600`    | Cycle interval (1 hour)                                      |
| `PROMOTION_MAX_COLUMNS`               | `50`      | Max total materialized columns (prevents schema bloat)       |
| `PROMOTION_MIN_DAYS_SINCE_FIRST_SEEN` | `1`       | Property must exist for N days before promotion              |
| `MANUAL_PROMOTIONS`                   | _(empty)_ | Comma-separated `name:type` pairs, processed once on startup |

ClickHouse connection env vars are inherited from `@quantyx/clickhouse` lib.

**`src/helpers/sanitize.ts`** — Column name sanitizer:

- `toColumnName("idAccount")` → `mat_idaccount`
- Lowercase, replace non-alphanumeric with `_`, collapse consecutive `_`, truncate to 63 chars
- `toColumnNameWithType(name, type)` adds suffix (`_str`, `_num`, `_boo`) for multi-type collision

**`src/models/clickhouse.ts`** — Raw ClickHouse queries:

- `fetchPromotionCandidates(minEventCount, minDays)` — Aggregates `property_metadata` across all projects, returns properties above threshold. Uses `-Merge` combinators and parameterized queries.
- `fetchPromotedColumns()` — Returns all active promoted columns from tracking table
- `addMaterializedColumn(columnName, chType, mapColumn, propertyName)` — `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- `materializeColumn(columnName)` — `ALTER TABLE MATERIALIZE COLUMN` (backfill)
- `checkColumnExists(columnName)` — Checks `system.columns`
- `insertPromotedColumn(...)` — Records promotion in tracking table

**SQL injection safety:** Property names in `MATERIALIZED props_str['<name>']` expressions can't use parameterized queries (DDL limitation). The sanitizer strips all non-alphanumeric chars from column names, and the original property name is escaped by replacing `'` with `''` before inclusion in the `MATERIALIZED` expression.

**`src/services/detection-service.ts`** — Detection logic:

1. Fetch already-promoted set
2. Fetch candidates from `property_metadata` above threshold
3. Filter out already-promoted
4. Respect `PROMOTION_MAX_COLUMNS` cap
5. Return ordered by event count descending

**`src/services/promotion-service.ts`** — Orchestration:

1. On first cycle: process `MANUAL_PROMOTIONS` env var
2. Call detection service for auto-candidates
3. For each candidate: sanitize name → check column exists → ADD COLUMN → track → MATERIALIZE
4. Handle multi-type collision (same property name, different type) by appending type suffix
5. Continue on individual failures (don't let one failed promotion block the rest)

**`src/controllers/app-ctrl.ts`** — Lifecycle:

- Run initial cycle immediately on startup
- `setInterval` for subsequent cycles
- Graceful shutdown on SIGINT/SIGTERM clears the interval

**`src/main.ts`** — Supports `--promote name:type` for one-shot CLI promotion, otherwise starts the scheduler loop.

**Type mapping:**

| `property_type` | ClickHouse column type | Source Map column |
| --------------- | ---------------------- | ----------------- |
| `string`        | `String`               | `props_str`       |
| `number`        | `Float64`              | `props_num`       |
| `boolean`       | `UInt8`                | `props_bool`      |

### 4. Update Grafana dashboard

Add a "Property Promotion" row to `infrastructure/grafana/provisioning/dashboards/json/quantyx-analytics.json` with:

- **Promoted Columns** (table) — All promoted columns from `analytics.promoted_columns`
- **Promotion Candidates** (table) — Properties above threshold not yet promoted (preview of next cycle)
- **Promoted Column Count** (stat) — Active promoted count vs max allowed

### 5. Update docs

- `CLAUDE.md` — Add `worker-property-promotion` to Project Names, document in Architecture section
- `OVERVIEW.md` — Add new app section with env vars table

## Files

| File                                                                    | Action                                       |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `infrastructure/clickhouse/init/02_promoted_columns.sql`                | New — tracking table DDL                     |
| `apps/worker-property-promotion/package.json`                           | New — Nx targets (build, serve)              |
| `apps/worker-property-promotion/tsconfig.json`                          | New                                          |
| `apps/worker-property-promotion/tsconfig.app.json`                      | New — refs: clickhouse, shared-backend       |
| `apps/worker-property-promotion/tsconfig.spec.json`                     | New                                          |
| `apps/worker-property-promotion/vitest.config.ts`                       | New                                          |
| `apps/worker-property-promotion/eslint.config.mjs`                      | New                                          |
| `apps/worker-property-promotion/.env.example`                           | New                                          |
| `apps/worker-property-promotion/src/main.ts`                            | New                                          |
| `apps/worker-property-promotion/src/helpers/env.ts`                     | New                                          |
| `apps/worker-property-promotion/src/helpers/sanitize.ts`                | New                                          |
| `apps/worker-property-promotion/src/helpers/sanitize.spec.ts`           | New                                          |
| `apps/worker-property-promotion/src/models/clickhouse.ts`               | New                                          |
| `apps/worker-property-promotion/src/models/clickhouse.spec.ts`          | New                                          |
| `apps/worker-property-promotion/src/services/detection-service.ts`      | New                                          |
| `apps/worker-property-promotion/src/services/detection-service.spec.ts` | New                                          |
| `apps/worker-property-promotion/src/services/promotion-service.ts`      | New                                          |
| `apps/worker-property-promotion/src/services/promotion-service.spec.ts` | New                                          |
| `apps/worker-property-promotion/src/controllers/app-ctrl.ts`            | New                                          |
| `infrastructure/grafana/.../quantyx-analytics.json`                     | Edit — add Property Promotion row            |
| `CLAUDE.md`                                                             | Edit — add to Project Names + Architecture   |
| `OVERVIEW.md`                                                           | Edit — add worker-property-promotion section |

## Verification

1. `docker compose down -v && docker compose up -d` — Recreate ClickHouse to pick up `02_promoted_columns.sql`
2. `MANUAL_PROMOTIONS=idAccount:string npx nx serve worker-property-promotion` — Starts worker, immediately promotes `idAccount`
3. Verify column exists: `clickhouse-client --query "SELECT name, type, default_expression FROM system.columns WHERE database='analytics' AND table='events' AND name LIKE 'mat_%'"`
4. Verify tracking: `clickhouse-client --query "SELECT * FROM analytics.promoted_columns"`
5. `npx nx test worker-property-promotion` — Unit tests pass
6. Grafana at `localhost:3003` shows the new "Property Promotion" row with the promoted column listed
