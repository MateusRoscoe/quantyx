# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quantyx is a multi-tenant event analytics platform. Events are ingested via a Fastify API, forwarded to Kafka, consumed and stored in ClickHouse, with tenant/org management backed by PostgreSQL.

## Tech Stack

- **Runtime**: Node.js 24 (see .nvmrc), pnpm 10.30, TypeScript 5.9
- **Monorepo**: Nx 22.5 with esbuild for apps, SWC for test compilation
- **API Framework**: Fastify 5 with autoloaded plugins/routes, Zod validation via `fastify-type-provider-zod`
- **Databases**: ClickHouse (analytics events), PostgreSQL (tenants/auth via Prisma 7)
- **Messaging**: Kafka (KafkaJS) with KRaft single-node dev setup
- **Auth**: Better Auth with Prisma adapter
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

# Start infrastructure (ClickHouse, Postgres, Redis, Kafka, Kafbat UI)
docker compose up -d
```

## Project Names

Apps: `api-event-webhook`, `consumer-events-ingest`, `api-tenant-manager`
Libs: `shared`, `shared-backend`, `kafka`, `clickhouse`, `postgres`, `auth`

## Architecture

### Data Flow

```
HTTP Request → api-event-webhook (Fastify)
  → Zod validation (libs/shared validators)
  → Kafka producer (libs/kafka)
  → consumer-events-ingest (Kafka consumer)
  → ClickHouse insert (libs/clickhouse)
```

### Apps

- **api-event-webhook**: Fastify app using `@fastify/autoload` to load plugins from `plugins/` and routes from `routes/`. Entry: `src/main.ts`, app setup: `src/app/app.ts`. Endpoints: `/ingest`, `/ingest-bulk`. Enriches events with `ip_address` and `user_agent` before forwarding to Kafka.
- **consumer-events-ingest**: Kafka consumer that processes events and writes to ClickHouse. Controller pattern: `src/controllers/app-ctrl.ts` orchestrates `src/services/event-service.ts`.
- **api-tenant-manager**: Tenant/org management API. Recently scaffolded.

### Libs

- **shared**: Zod schemas (`validators.ts`) for EventMessage, EventMessageInput, country codes. Used by both apps and consumer.
- **shared-backend**: Pino logger factory with context support. `LOG_LEVEL` env var configurable.
- **kafka**: KafkaJS client wrapper with SASL support.
- **clickhouse**: ClickHouse client wrapper.
- **postgres**: Prisma client singleton with `@prisma/adapter-pg` connection pooling. Schema defines Organizations, Projects, and BetterAuth tables (User, Session, Account, Verification). Generated client output: `src/generated/`.
- **auth**: Better Auth configuration with its own Prisma schema.

### Infrastructure

- **ClickHouse**: `analytics` database. Init SQL in `infrastructure/clickhouse/init/`. Tables: `events` (MergeTree, 90-day TTL), `users` (ReplacingMergeTree), `metrics_daily` (AggregatingMergeTree), `property_metadata`.
- **PostgreSQL**: `quantyx` database. Prisma schema in `libs/postgres/prisma/schema.prisma`.
- **Kafka**: Single-node KRaft mode on port 29092 (host access). Kafbat UI on port 8080.

### Environment

Each app validates env vars with Zod in `src/helpers/env.ts`, exported as `environment`. See `.env.example` for required variables.

## Conventions

- All API payloads validated with Zod schemas from `libs/shared`
- Tests are co-located as `*.spec.ts` files; Jest with SWC compiler
- Integration tests use Testcontainers for external services
- Fastify apps use `@fastify/sensible` for HTTP error utilities
- Swagger docs auto-generated at `/docs` on running API apps
- Scaffold new projects with `npx nx g`
- ESLint flat config with `@nx/enforce-module-boundaries`
- Prettier with single quotes
