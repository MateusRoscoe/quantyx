# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quantyx is a multi-tenant event analytics platform. Events are ingested via a Fastify API, forwarded to Kafka, consumed and stored in ClickHouse, with tenant/org management backed by PostgreSQL.

## Tech Stack

- **Runtime**: Node.js 24 (see .nvmrc), pnpm 10.33, TypeScript 5.9
- **Monorepo**: Nx 22.6 with esbuild for apps, SWC for test compilation
- **API Framework**: Fastify 5.8 with autoloaded plugins/routes, Zod validation via `fastify-type-provider-zod`
- **Databases**: ClickHouse (analytics events), PostgreSQL (tenants/auth via Prisma 7)
- **Caching**: Redis (ioredis) for API key cache, session cache
- **Messaging**: Kafka (`@confluentinc/kafka-javascript` — KafkaJS-compatible API + native rdkafka producer) with KRaft single-node dev setup
- **Auth**: Better Auth with Prisma adapter; per-project API keys for event ingestion
- **Validation**: Zod 4 — all schemas live in `libs/shared`

## Commands

```bash
# Install dependencies (also runs prisma-generate via postinstall)
pnpm install

# Build / test / lint a specific project
npx nx build <project>
npx nx test <project>
npx nx lint <project>

# Run a single test file
npx nx test <project> -- --testPathPattern=<pattern>

# Start infrastructure (ClickHouse, Postgres, Redis, Kafka, Kafbat UI, Grafana, Mailpit)
docker compose up -d


# Serve an app in dev mode
npx nx serve <project>

# Typecheck across the workspace
npx nx run-many -t typecheck

# Prisma operations (postgres lib)
npx nx run postgres:prisma-generate
npx nx run postgres:prisma-migrate
npx nx run postgres:prisma-studio

# Docker
npx nx docker:build <app>
npx nx docker:run <app> -p 3000:3000

# Sync TypeScript project references
npx nx sync
```

## Project Names

Apps: `api-event-webhook`, `consumer-events-ingest`, `api-tenant-manager`, `api-analytics-bff`, `api-server-ingest`, `scheduler-analytics`, `web`, `web-e2e`
Libs: `shared`, `shared-backend`, `kafka`, `clickhouse`, `postgres`, `redis`, `auth`, `react-sdk`

## Architecture

### Data Flow

```
HTTP Request + X-API-Key → api-event-webhook (Fastify)
  → API key auth (Redis cache → PostgreSQL fallback)
  → Zod validation (libs/shared validators)
  → Inject project_id from API key
  → Kafka producer (libs/kafka)
  → consumer-events-ingest (Kafka consumer)
  → ClickHouse insert (libs/clickhouse)
```

### Apps

- **api-event-webhook**: Fastify app using `@fastify/autoload` to load plugins from `plugins/` and routes from `routes/`. Entry: `src/main.ts`, app setup: `src/app/app.ts`. Endpoints: `/ingest`, `/ingest-bulk`. Authenticates via `X-API-Key` header (Redis-cached, PostgreSQL-backed). Enriches events with `project_id`, `ip_address`, and `user_agent` before forwarding to Kafka. Plugin ordering: `01-sensible.ts`, `02-api-key-auth.ts`.
- **consumer-events-ingest**: Kafka consumer that processes events and writes to ClickHouse. Controller pattern: `src/controllers/app-ctrl.ts` orchestrates `src/services/event-service.ts`.
- **scheduler-analytics**: Standalone scheduled task runner for ClickHouse maintenance. Supports `daemon` mode (24/7 with `setInterval`) and `oneshot` mode (run once and exit, for K8s CronJob). Currently handles property metadata backfill via watermark-based queries.
- **api-tenant-manager**: Tenant/org management API. CRUD for organizations, projects, API keys, and members.
- **api-analytics-bff**: Read-only analytics querying API (port 3004). Serves aggregated data from ClickHouse to the web frontend. Session-based auth with Redis-cached session validation. Routes: overview KPIs, events, pages, devices, geography (with drill-down), sessions (list + detail), users (list + detail), properties, event feed, timeseries, groups (list + detail + members).
- **api-server-ingest**: Server-side identification API (port 3005). Sets user/group properties and group memberships via authenticated HTTP, producing system events to Kafka. Session-based auth. Routes: `POST /projects/:projectId/users/identify`, `POST /projects/:projectId/groups/identify`, `POST /projects/:projectId/groups/assign`. Uses `node-rdkafka` native producer (via `@quantyx/kafka`'s `createNativeProducer`).
- **interface/web**: Next.js 16 dashboard frontend (port 3000). Analytics dashboard with overview, events, pages, devices, geography, sessions, users, and properties views.
- **interface/web-e2e**: Playwright E2E tests for the web dashboard.

### Libs

- **shared**: Zod schemas (`validators.ts`) for EventMessage, EventMessageInput, API keys, country codes. Used by both apps and consumer.
- **shared-backend**: Pino logger factory with context support; API key crypto utilities (`generateApiKey`, `hashApiKey`). `LOG_LEVEL` env var configurable.
- **kafka**: `@confluentinc/kafka-javascript` wrapper with SASL support. Exports KafkaJS-compatible `createProducer`/`createConsumer`/`createAdmin` and a native `createNativeProducer` (rdkafka).
- **clickhouse**: ClickHouse client wrapper.
- **postgres**: Prisma client singleton with `@prisma/adapter-pg` connection pooling. Schema defines Organizations, Projects, ApiKeys, and BetterAuth tables (User, Session, Account, Verification). Generated client output: `src/generated/`.
- **redis**: ioredis client wrapper with lazy connect, health check, connect/disconnect helpers.
- **auth**: Better Auth configuration with Prisma adapter.
- **react-sdk**: Browser event tracking SDK (publishable npm package). Provides React hooks and a vanilla JS client for sending events to the ingestion API.

### Infrastructure

- **ClickHouse**: `analytics` database. Init SQL in `infrastructure/clickhouse/init/`. Tables: `events` (MergeTree, 14-month TTL), `users` (AggregatingMergeTree, with server_props), `groups` (AggregatingMergeTree, with server_props), `user_groups` (AggregatingMergeTree), `sessions` (AggregatingMergeTree), `sessions_daily` (AggregatingMergeTree, SimpleAggregateFunction), `session_user_map` (ReplacingMergeTree), `metrics_hourly` (AggregatingMergeTree), `metrics_geo` (AggregatingMergeTree), `city_coordinates` (AggregatingMergeTree), `property_metadata` (AggregatingMergeTree), `property_metadata_watermark` (ReplacingMergeTree). 11 materialized views handle pre-aggregation from `events`. `property_metadata` is populated by the `scheduler-analytics` app via scheduled backfill queries (not MVs).
- **PostgreSQL**: `quantyx` database. Prisma schema in `libs/postgres/prisma/schema.prisma`.
- **Redis**: API key cache with configurable TTL. Port 6379.
- **Kafka**: Single-node KRaft mode on port 29092 (host access). Kafbat UI on port 8080.
- **Grafana**: Pre-provisioned dashboards and ClickHouse datasource. Port 3003. Config in `infrastructure/grafana/provisioning/`.
- **Mailpit**: Local SMTP testing. SMTP port 1025, web UI port 8025.

### Environment

Each app validates env vars with Zod in `src/helpers/env.ts`, exported as `environment`. See `.env.example` for required variables. Per-app `.env.example` files exist in each app directory.

### TypeScript

Composite project references with `emitDeclarationOnly`. ESM throughout (`module: "nodenext"`). Custom export condition `@quantyx/source` in `tsconfig.base.json` for monorepo source imports. Some libs (shared, kafka, shared-backend, clickhouse, postgres, auth, redis) are excluded from Nx build targets — they're consumed as source via project references.

### CI

GitHub Actions on push to main and PRs. Single `ubuntu-latest` runner (no Nx Cloud). Pipeline: `format:check` → `lint`, `test`, `build`, `typecheck`, `e2e` (parallel via `run-many`).

## Conventions

- All API payloads validated with Zod schemas from `libs/shared`
- Tests are co-located as `*.spec.ts` files; Vitest with SWC compiler, `globals: true` (no imports needed for `describe`/`it`/`expect`/`vi`)
- Integration tests use Testcontainers for external services; each app with integration tests has a `vitest.globalSetup.ts` that starts containers
- E2E tests use Playwright (in `apps/interface/web-e2e`)
- Fastify apps use `@fastify/sensible` for HTTP error utilities
- Swagger docs auto-generated at `/docs` on running API apps
- Scaffold new projects with `npx nx g`
- ESLint flat config with `@nx/enforce-module-boundaries`
- Prettier with single quotes

## Verification Requirements

- **Always verify changes with tests.** After modifying code, run the relevant project's tests (`npx nx test <project>`). If tests don't exist for the change, run typecheck at minimum (`npx nx run-many -t typecheck`).
- **When changing a library or schema, also test its consumers.** For example, changes to `libs/shared` should be followed by running tests for `api-event-webhook`, `consumer-events-ingest`, and any other app that imports from it.
- **ClickHouse schema changes must be validated against a fresh disposable container** before committing — never test against the docker-compose instance which may contain data or stale state:
  ```bash
  docker run --rm -d --name ch-test -p 19000:9000 clickhouse/clickhouse-server:latest
  sleep 2
  docker exec ch-test clickhouse-client --multiquery < infrastructure/clickhouse/init/01_create_tables.sql
  docker stop ch-test
  ```

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
