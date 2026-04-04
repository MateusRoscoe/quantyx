# TODOs

Outstanding work items for the Quantyx project, organized by category and priority.

---

## Infrastructure / DevOps

- [ ] **Kubernetes deployment example** — Add a Kustomize-based deployment example so users can clone, build images, push to a private registry, and deploy. Operators/resources: Strimzi (Kafka), CNPG (PostgreSQL), Redis Operator, ClickHouse (operator TBD). Include base manifests for all apps + infrastructure, with image references users can override via Kustomize.
- [ ] **ClickHouse data retention CronJob** — Add a K8s CronJob that drops old ClickHouse partitions instead of using TTL (avoids repeated merge rewrites on partially-expired monthly partitions). Targets: `analytics.events` (configurable, default 90 days) and `analytics.metrics_hourly` (configurable, default 1 year). Runs `ALTER TABLE ... DROP PARTITION` monthly.

---

## Features — Auth

- [ ] **OAuth provider configuration** — Configure at least one OAuth provider (e.g. GitHub or Google) in the BetterAuth config
- [ ] **Fix redirect after email verification** - Make sure the user is redirected to the dashboard after email verification now it's redirecting to the root of the api-tenant-manager

---

## Features — api-event-webhook

- [ ] **Rate limiting / quota enforcement** — Enforce per-tenant ingestion rate limits and event quotas (Redis-backed or in-process)
- [ ] **GeoIP enrichment** — Resolve IP addresses to country/city/region at ingestion time (e.g. MaxMind GeoLite2) so geo dimensions are populated automatically
- [ ] **Bot / crawler filtering** — Detect and discard non-human traffic based on user-agent patterns before forwarding to Kafka

---

## Features — consumer-events-ingest

- [ ] **Dead letter queue** — Route malformed or repeatedly failing messages to a DLQ topic instead of silently dropping them

---

## Features — Frontend

- [ ] **OAuth provider sign-in** — Add Google/GitHub social login buttons once OAuth is configured
- [ ] **Event analytics dashboard** — Build pages to visualize events from ClickHouse (charts for page views, sessions, funnels, browser/OS breakdowns)
- [ ] **Real-time event stream** — Live tail of incoming events for debugging (WebSocket or SSE)
- [ ] **Project settings page** — Inline SDK setup guide with copy-paste code snippets per project

---

## Features — ClickHouse

- [x] **Materialized views for `users` table** — Incrementally populate `analytics.users` (first_seen, last_seen, total_events) via a materialized view on `events` inserts
- [x] **Materialized views for `metrics_daily` table** — Incrementally populate `analytics.metrics_daily` pre-aggregated table via a materialized view on `events` inserts
- [ ] **Automated property promotion** — Detect high-traffic custom properties in Map columns (`props_str`, `props_num`, `props_bool`) and promote them to dedicated `MATERIALIZED` columns for 2-25x query speedup. Includes tracking table, configurable thresholds, manual promotion support, and Grafana visibility. Detailed plan saved at `memory/plan-property-promotion.md`. Depends on the querying API being built first so promotion integrates with dynamic query resolution.

---

## Features — New Apps / Libs

- [ ] **API BFF** — Create API to serve analytics data to the frontend with flexible querying (prevent SQL injection). Endpoints for time series, funnels, top pages, device breakdowns, etc.

---

## Testing

- [ ] **libs/kafka: tests** — No tests for the KafkaJS wrapper. Add unit tests with mocks and/or integration tests with Testcontainers.
- [ ] **libs/shared-backend: tests** — No tests for the Pino logger factory. Add unit tests.
- [ ] **libs/postgres: tests** — No tests for the Prisma client singleton. Add integration tests with Testcontainers Postgres.
- [ ] **react-sdk: integration test** — End-to-end test verifying events flow from SDK → api-event-webhook → Kafka → consumer → ClickHouse

---

## Observability

- [ ] **Metrics / monitoring** — No metrics beyond Pino logs. Add Prometheus metrics (e.g. via `fastify-metrics`) or integrate with an observability platform.
- [ ] **Structured health checks** — Add a consistent health check per service that verifies connectivity to Kafka, ClickHouse, and Postgres.
- [ ] **Alerting configuration** — Define alert rules for error rates, consumer lag, and service downtime.
- [ ] **Consumer lag monitoring** — Track Kafka consumer group lag to detect ingestion pipeline slowdowns
- [x] **Add Grafana dashboards** — Grafana added to docker-compose (port 3003, anonymous auth, ClickHouse datasource auto-provisioned). Pre-built "Quantyx Analytics" dashboard with panels for: overview stats, users, sessions, metrics daily (time series, pie charts, bar chart), and property metadata.

---

## Performance / Scaling

- [ ] **Kafka partitioning strategy** — Partition events by `project_id` for ordered per-tenant processing and better consumer parallelism
- [ ] **ClickHouse batch insert tuning** — Tune consumer batch sizes and flush intervals for optimal ClickHouse insert performance
- [ ] **Connection pooling review** — Audit PostgreSQL and Redis connection pool sizes for production workloads
- [ ] **SDK payload compression** — Add optional gzip compression to the React SDK's fetch calls for large batches
