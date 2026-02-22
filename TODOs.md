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
- [x] **Redis unused** — Redis is now used by `api-event-webhook` for API key caching

---

## Features — api-tenant-manager

- [x] **Zod type provider + env validation** — Set up `fastify-type-provider-zod` and a `src/helpers/env.ts` env validator (matching the pattern in `api-event-webhook`)
- [x] **CRUD routes: Organizations** — `GET /organizations`, `POST /organizations`, `GET /organizations/:id`, `PATCH /organizations/:id`, `DELETE /organizations/:id` (soft delete)
- [x] **CRUD routes: Projects** — `GET /organizations/:orgId/projects`, `POST /organizations/:orgId/projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id` (soft delete)
- [x] **Auth middleware integration** — Session-based auth via BetterAuth; all CRUD routes require a valid session cookie
- [x] **Tenant API key management** — Generate, rotate, and revoke API keys per tenant/project

---

## Features — Auth (libs/auth)

- [x] **Expose BetterAuth routes** — Mounted at `/api/auth/*` in `api-tenant-manager` with email/password sign-up/sign-in
- [ ] **OAuth provider configuration** — Configure at least one OAuth provider (e.g. GitHub or Google) in the BetterAuth config
- [ ] **Email verification flow** — Add email verification on signup
- [ ] **Password reset flow** — Add forgot-password / reset-password endpoints
- [x] **Auth middleware** — Session validation preHandler plugin in `api-tenant-manager`; skips `/healthz`, `/docs`, `/api/auth/*`

---

## Features — api-event-webhook

- [x] **Project ID validation** — Before ingesting an event, verify the `project_id` exists in PostgreSQL. Reject unknown projects with `400` or `403`.
- [x] **API key authentication** — Authenticate ingest requests using a per-project API key (`X-API-Key` header), resolved via Redis cache → PostgreSQL fallback
- [ ] **Rate limiting / quota enforcement** — Enforce per-tenant ingestion rate limits and event quotas (Redis-backed or in-process)

---

## Features — Future Apps

- [ ] **API BFF** — Create API to serve data to the frontend with flexible querying (prevent SQL injection)
- [ ] **Frontend** — Build UI to visualize events with real-time updates
- [ ] **React SDK** — Client-side SDK to let end users track events directly from the browser (e.g. button clicks, page views, custom actions). Should provide hooks/components and auto-batch requests to the ingest API.

---

## Testing

- [x] **Migrate from Jest to Vitest** — Replaced Jest + @swc/jest with Vitest v3 across all 6 projects. Uses `globals: true`, `server.deps.inline: true`, and a `resolve-ts-from-js` Vite plugin for Prisma 7 compatibility.
- [x] **api-tenant-manager: integration tests** — 27 integration tests covering Organizations and Projects CRUD with Testcontainers Postgres.
- [ ] **consumer-events-ingest: unit tests** — `src/services/event-service.ts` has zero test coverage. Add unit tests for event transformation logic.
- [ ] **consumer-events-ingest: integration tests** — Add Testcontainers-based integration tests for batch processing (Kafka → ClickHouse)
- [ ] **libs/kafka: tests** — No tests for the KafkaJS wrapper. Add unit tests with mocks and/or integration tests with Testcontainers.
- [ ] **libs/shared-backend: tests** — No tests for the Pino logger factory. Add unit tests.
- [ ] **libs/postgres: tests** — No tests for the Prisma client singleton. Add integration tests with Testcontainers Postgres.

---

## Observability

- [ ] **Metrics / monitoring** — No metrics beyond Pino logs. Add Prometheus metrics (e.g. via `fastify-metrics`) or integrate with an observability platform.
- [ ] **Structured health checks** — Add a consistent health check per service that verifies connectivity to Kafka, ClickHouse, and Postgres.
- [ ] **Alerting configuration** — Define alert rules for error rates, consumer lag, and service downtime.
