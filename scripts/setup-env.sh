#!/usr/bin/env bash
set -euo pipefail

# Navigate to the repo root (parent of scripts/)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

created=()
skipped=()

write_env() {
  local file="$1"
  local content="$2"

  if [[ -f "$file" ]]; then
    skipped+=("$file")
    return
  fi

  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$content" > "$file"
  created+=("$file")
}

# Generate random secrets (hex avoids URL-unsafe characters in connection strings)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CLICKHOUSE_PASSWORD=$(openssl rand -hex 24)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# 1. Root .env (used by docker-compose)
write_env ".env" "\
# Docker Compose infrastructure passwords
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"

# 2. api-event-webhook
write_env "apps/api-event-webhook/.env" "\
KAFKA_BROKERS=localhost:29092
POSTGRES_URL=postgresql://admin:${POSTGRES_PASSWORD}@localhost:5432/quantyx
REDIS_URL=redis://localhost:6379
API_KEY_CACHE_TTL_SECONDS=300"

# 3. api-tenant-manager
write_env "apps/api-tenant-manager/.env" "\
DATABASE_URL=postgresql://admin:${POSTGRES_PASSWORD}@localhost:5432/quantyx
HOST=localhost
PORT=3001
LOG_LEVEL=info
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
API_TENANT_MANAGER_EXTERNAL_URL=http://localhost:3001
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=mailpit
SMTP_PASS=mailpit
SMTP_FROM=noreply@quantyx.io
WEB_APP_URL=http://localhost:3000"

# 4. consumer-events-ingest
write_env "apps/consumer-events-ingest/.env" "\
KAFKA_BROKERS=localhost:29092
KAFKA_CONSUME_FROM_BEGINNING=true
CLICKHOUSE_USER=admin
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}"

# 5. web (Next.js)
write_env "apps/interface/web/.env" "\
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_QUANTYX_INGEST_URL=http://localhost:3002"

# Summary
echo ""
echo "===== setup-env summary ====="
if [[ ${#created[@]} -gt 0 ]]; then
  echo ""
  echo "Created:"
  for f in "${created[@]}"; do
    echo "  + $f"
  done
fi
if [[ ${#skipped[@]} -gt 0 ]]; then
  echo ""
  echo "Skipped (already exist):"
  for f in "${skipped[@]}"; do
    echo "  ~ $f"
  done
fi
echo ""
echo "Done. You can now run: bash scripts/dev.sh"
