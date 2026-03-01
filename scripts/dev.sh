#!/usr/bin/env bash
set -euo pipefail

# Navigate to the repo root (parent of scripts/)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
err()   { echo -e "${RED}[error]${NC} $*"; }

# ── Cleanup on exit ──────────────────────────────────────────
cleanup() {
  echo ""
  info "Shutting down..."
  kill 0 2>/dev/null || true
  wait 2>/dev/null || true
  ok "All processes stopped."
}
trap cleanup EXIT INT TERM

# ── 1. Prerequisites ─────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  err "Docker is not installed. Please install Docker first."
  exit 1
fi

if ! docker info &>/dev/null; then
  err "Docker daemon is not running. Please start Docker first."
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  err "pnpm is not installed. Please install pnpm first."
  exit 1
fi

# Check .env files exist
MISSING_ENVS=()
for envfile in \
  .env \
  apps/api-event-webhook/.env \
  apps/api-tenant-manager/.env \
  apps/consumer-events-ingest/.env \
  apps/interface/web/.env; do
  if [[ ! -f "$envfile" ]]; then
    MISSING_ENVS+=("$envfile")
  fi
done

if [[ ${#MISSING_ENVS[@]} -gt 0 ]]; then
  err "Missing .env files:"
  for f in "${MISSING_ENVS[@]}"; do
    echo "    $f"
  done
  echo ""
  info "Run 'bash scripts/setup-env.sh' first to generate them."
  exit 1
fi

ok "Prerequisites OK."

# ── 2. Start Docker infrastructure ──────────────────────────
info "Starting Docker infrastructure..."
docker compose up -d
ok "Docker containers started."

# ── 3. Wait for PostgreSQL ──────────────────────────────────
info "Waiting for PostgreSQL to be ready..."
MAX_WAIT=60
WAITED=0
until docker exec quantyx-postgres pg_isready -U admin -d quantyx &>/dev/null; do
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    err "PostgreSQL did not become ready within ${MAX_WAIT}s."
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done
ok "PostgreSQL is ready (${WAITED}s)."

# ── 4. Run Prisma migrations ────────────────────────────────
info "Running Prisma migrations..."
pnpm nx run postgres:prisma-migrate
ok "Migrations applied."

# ── 5. Start all apps ───────────────────────────────────────
info "Starting all apps..."
pnpm nx run-many -t serve dev --projects=api-event-webhook,api-tenant-manager,consumer-events-ingest,web &
NX_PID=$!

# Give apps a moment to boot
sleep 5

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Quantyx dev stack is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Web app:       ${CYAN}http://localhost:3000${NC}"
echo -e "  Tenant API:    ${CYAN}http://localhost:3001${NC}  (Swagger: /docs)"
echo -e "  Event API:     ${CYAN}http://localhost:3002${NC}  (Swagger: /docs)"
echo -e "  MailHog:       ${CYAN}http://localhost:8025${NC}"
echo -e "  Kafka UI:      ${CYAN}http://localhost:8080${NC}"
echo -e "  ClickHouse:    ${CYAN}http://localhost:8123${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services."
echo ""

wait $NX_PID
