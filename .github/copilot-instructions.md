# Copilot Instructions for Quantyx Monorepo

## Project Overview

- **Monorepo managed by Nx**: Contains multiple apps and libraries. Nx handles builds, dependency graph, and project references.
- **Key apps**: `api-event-webhook` (Fastify-based event ingestion API), with plans for `event-consumer`, `api-bff`, and `frontend` (see TODOs.md).
- **Shared code**: Place reusable logic in `libs/shared`.

## Developer Workflows

- **Build, test, and run tasks**: Use Nx CLI. Example: `npx nx build <project>`, `npx nx test <project>`, `npx nx serve <project>`.
- **TypeScript project references**: Nx auto-syncs references. To manually sync: `npx nx sync`. To check in CI: `npx nx sync:check`.
- **Release/versioning**: Use `npx nx release` (see README for details).
- **Docker**: Build images with `npx nx docker:build <app>`. Run with `npx nx docker:run <app> -p 3000:3000`.
- **Testing**: Uses Jest with SWC. Configs in each project (see `jest.config.cts`).

## Architecture & Patterns

- **API structure**: Fastify app in `apps/api-event-webhook/src/app/app.ts` autoloads plugins and routes from `plugins/` and `routes/`.
- **Event ingestion**: `/ingest` and `/ingest-bulk` endpoints accept event payloads, enrich with `ip_address` and `user_agent`, and forward to Kafka (see `models/kafka.ts`).
- **Validation**: Event schemas defined in `libs/shared/src/lib/validators.ts` using Zod. All incoming events are validated.
- **Environment config**: Use Zod schema in `helpers/env.ts` for strict env var validation. Access via `environment` export.
- **Error handling**: Uses `@fastify/sensible` for HTTP error utilities (see `plugins/sensible.ts`).

## Conventions & Practices

- **Strict schema validation**: All API payloads must be validated with Zod schemas from `libs/shared`.
- **Extend via Nx generators**: Use `npx nx g` to scaffold new libs/apps.
- **Keep shared logic in `libs/shared`**: Validators, types, and utilities should be placed here for reuse.
- **Testing**: Place tests alongside code as `*.spec.ts` files.
- **ESLint**: Enforced via Nx and custom config in `eslint.config.mjs`.

## Integration Points

- **Kafka**: All event ingestion routes forward to Kafka using producer logic in `models/kafka.ts`. Kafka config is controlled by env vars and validated.
- **Swagger docs**: API docs available at `/docs` when running the API app.
- **ClickHouse**: Database schema/init scripts in `infrastructure/clickhouse/init/` (future integration for event storage).

## References

- [README.md](../README.md): Nx usage, project commands, and CI setup
- [TODOs.md](../TODOs.md): Roadmap and planned features
- [libs/shared/README.md](../libs/shared/README.md): Shared library usage
- [apps/api-event-webhook/Dockerfile](../apps/api-event-webhook/Dockerfile): Docker build/run instructions

---

**When in doubt, prefer Nx CLI for all project operations.**
