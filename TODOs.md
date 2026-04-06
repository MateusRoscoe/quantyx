# TODOs

Outstanding work items for the Quantyx project, organized by category and priority.

---

## Infrastructure / DevOps

- [ ] **Kubernetes deployment example** — Add a Kustomize-based deployment example so users can clone, build images, push to a private registry, and deploy. Operators/resources: Strimzi (Kafka), CNPG (PostgreSQL), Redis Operator, ClickHouse (operator TBD). Include base manifests for all apps + infrastructure, with image references users can override via Kustomize.

---

## Features — Auth

- [ ] **OAuth provider configuration** — Configure at least one OAuth provider (e.g. GitHub or Google) in the BetterAuth config

---

## Features — api-event-webhook

- [ ] **Rate limiting / quota enforcement** — Enforce per-tenant ingestion rate limits and event quotas (Redis-backed or in-process)
- [ ] **Bot / crawler filtering** — Detect and discard non-human traffic based on user-agent patterns before forwarding to Kafka

---

## Features — consumer-events-ingest

- [ ] **Dead letter queue** — Route malformed or repeatedly failing messages to a DLQ topic instead of silently dropping them

---

## Features — Frontend

- [ ] **OAuth provider sign-in** — Add Google/GitHub social login buttons once OAuth is configured

---

## Features — ClickHouse

- [ ] **Automated property promotion** — Detect high-traffic custom properties in Map columns (`props_str`, `props_num`, `props_bool`) and promote them to dedicated `MATERIALIZED` columns for 2-25x query speedup. Includes tracking table, configurable thresholds, manual promotion support, and Grafana visibility. Detailed plan saved at `memory/plan-property-promotion.md`. Depends on the querying API being built first so promotion integrates with dynamic query resolution.

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

---

## Performance / Scaling

- [ ] **ClickHouse batch insert tuning** — Tune consumer batch sizes and flush intervals for optimal ClickHouse insert performance
- [ ] **Connection pooling review** — Audit PostgreSQL and Redis connection pool sizes for production workloads
