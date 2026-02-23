# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quantyx is a multi-tenant event analytics platform. Events are ingested via a Fastify API, forwarded to Kafka, consumed and stored in ClickHouse, with tenant/org management backed by PostgreSQL.

## Tech Stack

- **Runtime**: Node.js 24 (see .nvmrc), pnpm 10.30, TypeScript 5.9
- **Monorepo**: Nx 22.5 with esbuild for apps, SWC for test compilation
- **API Framework**: Fastify 5 with autoloaded plugins/routes, Zod validation via `fastify-type-provider-zod`
- **Databases**: ClickHouse (analytics events), PostgreSQL (tenants/auth via Prisma 7)
- **Caching**: Redis (ioredis) for API key cache
- **Messaging**: Kafka (KafkaJS) with KRaft single-node dev setup
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
Libs: `shared`, `shared-backend`, `kafka`, `clickhouse`, `postgres`, `redis`, `auth`

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
- **api-tenant-manager**: Tenant/org management API. CRUD for organizations, projects, and API keys.

### Libs

- **shared**: Zod schemas (`validators.ts`) for EventMessage, EventMessageInput, API keys, country codes. Used by both apps and consumer.
- **shared-backend**: Pino logger factory with context support; API key crypto utilities (`generateApiKey`, `hashApiKey`). `LOG_LEVEL` env var configurable.
- **kafka**: KafkaJS client wrapper with SASL support.
- **clickhouse**: ClickHouse client wrapper.
- **postgres**: Prisma client singleton with `@prisma/adapter-pg` connection pooling. Schema defines Organizations, Projects, ApiKeys, and BetterAuth tables (User, Session, Account, Verification). Generated client output: `src/generated/`.
- **redis**: ioredis client wrapper with lazy connect, health check, connect/disconnect helpers.
- **auth**: Better Auth configuration with its own Prisma schema.

### Infrastructure

- **ClickHouse**: `analytics` database. Init SQL in `infrastructure/clickhouse/init/`. Tables: `events` (MergeTree, 90-day TTL), `users` (ReplacingMergeTree), `metrics_daily` (AggregatingMergeTree), `property_metadata`.
- **PostgreSQL**: `quantyx` database. Prisma schema in `libs/postgres/prisma/schema.prisma`.
- **Redis**: API key cache with configurable TTL. Port 6379.
- **Kafka**: Single-node KRaft mode on port 29092 (host access). Kafbat UI on port 8080.

### Environment

Each app validates env vars with Zod in `src/helpers/env.ts`, exported as `environment`. See `.env.example` for required variables.

## Conventions

- All API payloads validated with Zod schemas from `libs/shared`
- Tests are co-located as `*.spec.ts` files; Vitest with SWC compiler
- Integration tests use Testcontainers for external services
- Fastify apps use `@fastify/sensible` for HTTP error utilities
- Swagger docs auto-generated at `/docs` on running API apps
- Scaffold new projects with `npx nx g`
- ESLint flat config with `@nx/enforce-module-boundaries`
- Prettier with single quotes

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
