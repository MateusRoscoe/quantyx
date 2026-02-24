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
- [ ] **Dockerfile for web app** — `apps/interface/web` has no Dockerfile. Needs a Next.js standalone build (`output: 'standalone'` in next.config.js), different from the Node.js apps.
- [ ] **Kubernetes deployment example** — Add a Kustomize-based deployment example so users can clone, build images, push to a private registry, and deploy. Operators/resources: Strimzi (Kafka), CNPG (PostgreSQL), Redis Operator, ClickHouse (operator TBD). Include base manifests for all apps + infrastructure, with image references users can override via Kustomize.

---

## Features — api-tenant-manager

- [x] **Zod type provider + env validation** — Set up `fastify-type-provider-zod` and a `src/helpers/env.ts` env validator (matching the pattern in `api-event-webhook`)
- [x] **CRUD routes: Organizations** — `GET /organizations`, `POST /organizations`, `GET /organizations/:id`, `PATCH /organizations/:id`, `DELETE /organizations/:id` (soft delete)
- [x] **CRUD routes: Projects** — `GET /organizations/:orgId/projects`, `POST /organizations/:orgId/projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id` (soft delete)
- [x] **Auth middleware integration** — Session-based auth via BetterAuth; all CRUD routes require a valid session cookie
- [x] **Tenant API key management** — Generate, rotate, and revoke API keys per tenant/project
- [x] **Organization membership & authorization** — Join table (`OrganizationMember`) with role-based access control (owner/admin/member). All routes enforce membership checks; projects and API keys inherit access from parent org.

---

## Features — Auth (libs/auth)

- [x] **Expose BetterAuth routes** — Mounted at `/api/auth/*` in `api-tenant-manager` with email/password sign-up/sign-in
- [ ] **OAuth provider configuration** — Configure at least one OAuth provider (e.g. GitHub or Google) in the BetterAuth config
- [x] **Email verification flow** — Add email verification on signup
- [x] **Password reset flow** — Add forgot-password / reset-password endpoints
- [x] **Auth middleware** — Session validation preHandler plugin in `api-tenant-manager`; skips `/healthz`, `/docs`, `/api/auth/*`

---

## Features — api-event-webhook

- [x] **Project ID validation** — Before ingesting an event, verify the `project_id` exists in PostgreSQL. Reject unknown projects with `400` or `403`.
- [x] **API key authentication** — Authenticate ingest requests using a per-project API key (`X-API-Key` header), resolved via Redis cache → PostgreSQL fallback
- [ ] **Rate limiting / quota enforcement** — Enforce per-tenant ingestion rate limits and event quotas (Redis-backed or in-process)

---

## Features — web (Frontend)

- [x] **Next.js App Router scaffolding** — `apps/interface/web` with shadcn/ui, Tailwind CSS v4, TanStack Query
- [x] **Auth pages** — Login, Register, Verify Email, Forgot Password, Reset Password
- [x] **Dashboard shell** — Sidebar layout with session guard (BetterAuth React client)
- [x] **Organizations CRUD** — List, create, edit, delete (with confirmation)
- [x] **Projects CRUD** — List, create, edit, delete (with confirmation)
- [x] **API Keys management** — List, create (show-once + copy), delete
- [x] **Members management** — List, add, role change, remove
- [x] **CORS support** — `@fastify/cors` added to api-tenant-manager with `WEB_APP_URL` env var
- [x] **Browser-compatible shared lib** — Replaced `country-code-lookup` with generated static `country-data.ts`
- [ ] **OAuth provider sign-in** — Add Google/GitHub social login buttons once OAuth is configured
- [ ] **Event analytics dashboard** — Build pages to visualize events from ClickHouse (requires API BFF)
- [x] **Dark mode** — Add theme toggle (CSS variables already support `.dark` class)
- [x] **`.env.example` for web app** — `apps/interface/web` is missing a `.env.example`. Should document `NEXT_PUBLIC_API_URL`.
- [x] **Breadcrumb navigation** — Dashboard has no breadcrumbs. Deep routes like `/organizations/:orgId/projects/:projectId/settings` require browser back button to navigate up. Add a breadcrumb component to the dashboard layout.
- [x] **Frontend tests** — 49 tests with Vitest + React Testing Library covering API client, utility functions, TanStack Query hooks, and components (theme toggle, breadcrumbs).

---

## Features — Future Apps

- [ ] **API BFF** — Create API to serve data to the frontend with flexible querying (prevent SQL injection)
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

## Documentation

- [ ] **Rewrite README.md** — The root README is outdated. Should cover: project description, prerequisites, quickstart (docker compose + nx serve), project structure, how to run tests, how to create a new org/project/API key end-to-end, and links to OVERVIEW.md for architecture details.

---

## Observability

- [ ] **Metrics / monitoring** — No metrics beyond Pino logs. Add Prometheus metrics (e.g. via `fastify-metrics`) or integrate with an observability platform.
- [ ] **Structured health checks** — Add a consistent health check per service that verifies connectivity to Kafka, ClickHouse, and Postgres.
- [ ] **Alerting configuration** — Define alert rules for error rates, consumer lag, and service downtime.
