# TODOs

Outstanding work items for the Quantyx project, organized by category and priority.

---

## Bugs / Broken

- [ ] **CI pipeline misconfigured** — `.github/workflows/ci.yml` uses `npm ci` instead of `pnpm install` and targets Node 20 instead of Node 24 (see `.nvmrc`)
- [ ] **Stale duplicate Prisma schema** — `libs/auth/prisma/schema.prisma` has a conflicting ID strategy (ulid) vs the main schema in `libs/postgres/prisma/schema.prisma` (uuidv7). Reconcile or remove the duplicate.

## Infrastructure / DevOps

- [ ] **Missing Dockerfiles** — `consumer-events-ingest` and `api-tenant-manager` have no Dockerfiles (only `api-event-webhook` has one)
- [ ] **No Prisma migrations committed** — No `prisma/migrations/` directory exists; schema changes aren't tracked or reproducible
- [ ] **Redis unused** — Redis is defined in `docker-compose.yml` but no app references it. Either wire it up or remove it.

## Features — api-tenant-manager

- [ ] Zod type provider + env validation setup (like the other apps)
- [ ] CRUD routes for Organizations
- [ ] CRUD routes for Projects
- [ ] Auth middleware integration (once auth is wired up)
- [ ] Tenant API key management

## Features — Auth (libs/auth)

- [ ] Expose BetterAuth routes (register, login, logout, session)
- [ ] OAuth provider configuration
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Auth middleware for protecting API routes

## Features — api-event-webhook

- [ ] Tenant ID validation (verify tenant exists before ingesting)
- [ ] API key authentication on ingest endpoints
- [ ] Rate limiting / quota checking per tenant

## Features — Future Apps

- [ ] **API BFF** — Create API to serve data to the frontend with flexible querying (prevent SQL injection)
- [ ] **Frontend** — Build UI to visualize events with real-time updates

## Testing

- [ ] `consumer-events-ingest` — Zero tests; need unit tests for `event-service.ts` transformation + integration tests for batch processing
- [ ] `libs/kafka` — No tests
- [ ] `libs/shared-backend` — No tests
- [ ] `libs/postgres` — No tests
- [ ] `api-tenant-manager` — Only placeholder test; needs real tests as routes are built

## Observability

- [ ] No metrics/monitoring beyond Pino logging
- [ ] No structured health check aggregation across services
- [ ] No alerting configuration
