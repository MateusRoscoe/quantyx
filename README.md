<p align="center">
  <img src="docs/banner.svg" alt="Quantyx - Event Analytics Platform" width="100%" />
</p>

# Quantyx

A multi-tenant event analytics platform. Users send behavioral events (page views, clicks, custom actions) via HTTP, which flow through Kafka into ClickHouse for analytics, with tenant and organization management backed by PostgreSQL.

For full architecture details, data models, and design decisions, see [OVERVIEW.md](./OVERVIEW.md).

## Prerequisites

| Tool                                               | Version | Notes                                           |
| -------------------------------------------------- | ------- | ----------------------------------------------- |
| [Node.js](https://nodejs.org/)                     | 24.x    | See `.nvmrc` — use `nvm use` or `fnm use`       |
| [pnpm](https://pnpm.io/)                           | 10.30+  | Corepack: `corepack enable && corepack prepare` |
| [Docker](https://www.docker.com/)                  | 24+     | Required for infrastructure services            |
| [Docker Compose](https://docs.docker.com/compose/) | v2+     | Included with Docker Desktop                    |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/MateusRoscoe/quantyx.git
cd quantyx
nvm use          # switches to Node 24
pnpm install     # installs deps + generates Prisma client
```

### 2. Start infrastructure

```bash
# Create a root .env from the example
cp .env.example .env
# Fill in CLICKHOUSE_PASSWORD, POSTGRES_PASSWORD, and BETTER_AUTH_SECRET
# Example:
#   CLICKHOUSE_PASSWORD=clickhouse
#   POSTGRES_PASSWORD=password
#   BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Start all infrastructure services
docker compose up -d
```

Wait for all services to be healthy:

```bash
docker compose ps   # all should show "healthy" or "running"
```

| Service    | Port                       | UI                    |
| ---------- | -------------------------- | --------------------- |
| PostgreSQL | 5432                       | —                     |
| ClickHouse | 8123 (HTTP), 9000 (native) | —                     |
| Kafka      | 29092 (host access)        | —                     |
| Redis      | 6379                       | —                     |
| Kafbat UI  | 8080                       | http://localhost:8080 |
| Grafana    | 3003                       | http://localhost:3003 |
| MailHog    | 1025 (SMTP), 8025 (web)    | http://localhost:8025 |

### 3. Configure app environment variables

Each app has its own `.env.example`. Copy and fill them in:

```bash
# api-event-webhook
cp apps/api-event-webhook/.env.example apps/api-event-webhook/.env
# Defaults work if your Postgres password is "password":
#   KAFKA_BROKERS=localhost:29092
#   POSTGRES_URL=postgresql://admin:password@localhost:5432/quantyx
#   REDIS_URL=redis://localhost:6379

# api-tenant-manager
cp apps/api-tenant-manager/.env.example apps/api-tenant-manager/.env
# Required: set DATABASE_URL and BETTER_AUTH_SECRET
#   DATABASE_URL=postgresql://admin:password@localhost:5432/quantyx
#   BETTER_AUTH_SECRET=<same value as root .env>
# SMTP vars can be left empty for local dev (email verification won't send)

# api-analytics-bff
cp apps/api-analytics-bff/.env.example apps/api-analytics-bff/.env
# Required: set DATABASE_URL
#   DATABASE_URL=postgresql://admin:password@localhost:5432/quantyx

# api-server-ingest
cp apps/api-server-ingest/.env.example apps/api-server-ingest/.env
# Required: set DATABASE_URL
#   DATABASE_URL=postgresql://admin:password@localhost:5432/quantyx

# consumer-events-ingest — uses Kafka/ClickHouse env vars from libs,
# no app-level .env needed for defaults

# web
cp apps/interface/web/.env.example apps/interface/web/.env
# Defaults work as-is:
#   NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Run database migrations

```bash
npx nx run postgres:prisma-migrate
```

This applies all Prisma migrations to your local PostgreSQL.

### 5. Start the apps

Open separate terminals (or use a process manager):

```bash
# Terminal 1 — Event ingestion API (port 3002)
npx nx serve api-event-webhook

# Terminal 2 — Tenant management API (port 3001)
npx nx serve api-tenant-manager

# Terminal 3 — Analytics query API (port 3004)
npx nx serve api-analytics-bff

# Terminal 4 — Server-side identification API (port 3005)
npx nx serve api-server-ingest

# Terminal 5 — Kafka consumer
npx nx serve consumer-events-ingest

# Terminal 6 — Web frontend (port 3000)
npx nx dev web
```

Once running:

- **Web app**: http://localhost:3000
- **Tenant Manager Swagger**: http://localhost:3001/docs
- **Event Webhook Swagger**: http://localhost:3002/docs
- **Analytics BFF Swagger**: http://localhost:3004/docs
- **Server Ingest Swagger**: http://localhost:3005/docs
- **Kafbat UI**: http://localhost:8080

### 6. Create your first organization, project, and API key

1. Open http://localhost:3000 and register a new account
2. Create an organization, then create a project inside it
3. Go to the project page and create an API key — copy the plaintext key (shown once)
4. Test event ingestion:

```bash
curl -X POST http://localhost:3002/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "user-123",
    "event_name": "button_click",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }'
```

### 7. (Optional) Enable web analytics tracking

To have the web app send `page_view` and `sign_out` events to the ingest API:

```bash
# In apps/interface/web/.env:
NEXT_PUBLIC_QUANTYX_API_KEY=<your API key from step 6>
NEXT_PUBLIC_QUANTYX_INGEST_URL=http://localhost:3002
```

Restart the web app after setting these. Analytics is fully optional — the app works without them.

## Project Structure

```
quantyx/
├── apps/
│   ├── api-event-webhook/       # Fastify — event ingestion (port 3002)
│   ├── api-tenant-manager/      # Fastify — tenant/org management (port 3001)
│   ├── api-analytics-bff/       # Fastify — analytics queries (port 3004)
│   ├── api-server-ingest/       # Fastify — server-side identification (port 3005)
│   ├── consumer-events-ingest/  # Kafka consumer → ClickHouse
│   ├── scheduler-analytics/     # ClickHouse maintenance tasks
│   └── interface/
│       ├── web/                 # Next.js frontend (port 3000)
│       └── web-e2e/             # Playwright E2E tests
├── libs/
│   ├── shared/                  # Zod schemas (browser-compatible)
│   ├── shared-backend/          # Pino logger, API key crypto
│   ├── kafka/                   # Confluent Kafka wrapper
│   ├── clickhouse/              # ClickHouse client wrapper
│   ├── postgres/                # Prisma client + schema
│   ├── redis/                   # ioredis wrapper
│   ├── auth/                    # BetterAuth config
│   └── react-sdk/               # Browser event tracking SDK (publishable)
├── infrastructure/
│   └── clickhouse/init/         # ClickHouse init SQL scripts
├── docker-compose.yaml
├── nx.json
├── OVERVIEW.md                  # Full architecture documentation
└── TODOs.md                     # Outstanding work items
```

## Common Commands

```bash
# Build / test / lint a specific project
npx nx build <project>
npx nx test <project>
npx nx lint <project>

# Run a single test file
npx nx test <project> -- --testPathPattern=<pattern>

# Typecheck across the workspace
npx nx run-many -t typecheck

# Serve an app in dev mode
npx nx serve <project>

# Prisma operations
npx nx run postgres:prisma-generate    # regenerate client
npx nx run postgres:prisma-migrate     # apply migrations
npx nx run postgres:prisma-studio      # open Prisma Studio GUI

# Sync TypeScript project references
npx nx sync

# Visualize project dependency graph
npx nx graph

# Run only affected tasks (useful in PRs)
npx nx affected -t test lint build
```

## Running Tests

Tests use [Vitest](https://vitest.dev/). Some projects require Docker for Testcontainers-based integration tests.

```bash
# Unit tests (no Docker needed)
npx nx test shared              # Zod schemas
npx nx test auth                # auth config
npx nx test clickhouse          # client wrapper
npx nx test react-sdk           # SDK + React hooks

# Integration tests (need Docker)
npx nx test api-tenant-manager  # PostgreSQL via Testcontainers
npx nx test api-event-webhook   # Kafka + PostgreSQL + Redis via Testcontainers

# E2E tests (need Docker, starts apps automatically)
npx nx e2e web-e2e              # Playwright — auth flows + org CRUD

# Run all tests
npx nx run-many -t test

# Run with coverage
npx nx test <project> -- --coverage
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npx nx affected -t test lint typecheck` to validate
4. Open a pull request

### Code Conventions

- **Validation**: All API payloads validated with Zod schemas from `libs/shared`
- **Tests**: Co-located as `*.spec.ts` files; Vitest with `globals: true`
- **Linting**: ESLint flat config with `@nx/enforce-module-boundaries`
- **Formatting**: Prettier with single quotes
- **Fastify plugins**: Numeric prefix for deterministic autoload order (`01-sensible.ts`, `02-auth.ts`, etc.)
- **Imports**: Use `.js` extensions in library source (Node ESM / `nodenext` convention)

### Scaffolding

Generate new projects with Nx:

```bash
npx nx g @nx/node:app apps/my-new-app
npx nx g @nx/js:lib libs/my-new-lib
```
