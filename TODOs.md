# TODOs

Outstanding work items for the Quantyx project, organized by category and priority.

---

## Bugs / Broken

- [x] **CI pipeline misconfigured** — `.github/workflows/ci.yml` uses `npm ci` instead of `pnpm install` and targets Node 20 instead of Node 24 (see `.nvmrc`)
- [x] **Stale duplicate Prisma schema** — `libs/auth/prisma/schema.prisma` has a conflicting ID strategy (ulid) vs the main schema in `libs/postgres/prisma/schema.prisma` (uuidv7). Reconcile or remove the duplicate.

---

## Infrastructure / DevOps

- [x] **Missing Dockerfiles** — `consumer-events-ingest` and `api-tenant-manager` have no Dockerfiles (only `api-event-webhook` has one)
- [x] **No Prisma migrations committed** — No `prisma/migrations/` directory exists; schema changes aren't tracked or reproducible
- [x] **Redis unused** — Redis is defined in `docker-compose.yml` but no app references it. Either wire it up or remove it.

---

## Features — api-tenant-manager

- [x] **Zod type provider + env validation** — Set up `fastify-type-provider-zod` and a `src/helpers/env.ts` env validator (matching the pattern in `api-event-webhook`)
- [x] **CRUD routes: Organizations** — `GET /organizations`, `POST /organizations`, `GET /organizations/:id`, `PATCH /organizations/:id`, `DELETE /organizations/:id` (soft delete)
- [x] **CRUD routes: Projects** — `GET /organizations/:orgId/projects`, `POST /organizations/:orgId/projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id` (soft delete)
- [ ] **Auth middleware integration** — Protect routes once auth is wired up (see Auth section below)
- [ ] **Tenant API key management** — Generate, rotate, and revoke API keys per tenant/project

---

## Features — Auth (libs/auth)

- [ ] **Expose BetterAuth routes** — Mount register, login, logout, and session endpoints (likely via `api-tenant-manager` or a dedicated auth app)
- [ ] **OAuth provider configuration** — Configure at least one OAuth provider (e.g. GitHub or Google) in the BetterAuth config
- [ ] **Email verification flow** — Add email verification on signup
- [ ] **Password reset flow** — Add forgot-password / reset-password endpoints
- [ ] **Auth middleware** — Create reusable Fastify middleware (plugin) that validates sessions/JWTs and attaches tenant context to requests

---

## Features — api-event-webhook

- [ ] **Tenant ID validation** — Before ingesting an event, verify the `tenant_id` exists in PostgreSQL. Reject unknown tenants with `400` or `403`.
- [ ] **API key authentication** — Authenticate ingest requests using a per-tenant API key (header-based, e.g. `X-Api-Key`)
- [ ] **Rate limiting / quota enforcement** — Enforce per-tenant ingestion rate limits and event quotas (Redis-backed or in-process)

---

## Features — Future Apps

- [ ] **API BFF** — Create API to serve data to the frontend with flexible querying (prevent SQL injection)
- [ ] **Frontend** — Build UI to visualize events with real-time updates

---

## Testing

- [ ] **consumer-events-ingest: unit tests** — `src/services/event-service.ts` has zero test coverage. Add unit tests for event transformation logic.
- [ ] **consumer-events-ingest: integration tests** — Add Testcontainers-based integration tests for batch processing (Kafka → ClickHouse)
- [ ] **libs/kafka: tests** — No tests for the KafkaJS wrapper. Add unit tests with mocks and/or integration tests with Testcontainers.
- [ ] **libs/shared-backend: tests** — No tests for the Pino logger factory. Add unit tests.
- [ ] **libs/postgres: tests** — No tests for the Prisma client singleton. Add integration tests with Testcontainers Postgres.
- [ ] **api-tenant-manager: integration tests** — Health check test exists; add route-level integration tests for Organizations and Projects CRUD (Testcontainers Postgres).

---

## Observability

- [ ] **Metrics / monitoring** — No metrics beyond Pino logs. Add Prometheus metrics (e.g. via `fastify-metrics`) or integrate with an observability platform.
- [ ] **Structured health checks** — Add a consistent health check per service that verifies connectivity to Kafka, ClickHouse, and Postgres.
- [ ] **Alerting configuration** — Define alert rules for error rates, consumer lag, and service downtime.
