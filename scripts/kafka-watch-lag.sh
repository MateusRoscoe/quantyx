#!/usr/bin/env bash
#
# Watches Kafka consumer group lag, reporting totals across all partitions.
# Refreshes every INTERVAL seconds (default: 20).
#
set -euo pipefail

GROUP="${1:-consumer-events-ingest-group}"
INTERVAL="${2:-20}"
CONTAINER_NAME="${3:-kafka}"
BOOTSTRAP="${4:-kafka:9092}"

compact() {
  awk -v n="$1" 'BEGIN {
    if (n >= 1000000000) printf "%.1fB", n/1000000000
    else if (n >= 1000000) printf "%.1fM", n/1000000
    else if (n >= 1000) printf "%.1fk", n/1000
    else printf "%d", n
  }'
}

while true; do
  OUTPUT=$(docker compose exec -T "$CONTAINER_NAME" /opt/kafka/bin/kafka-consumer-groups.sh \
    --bootstrap-server "$BOOTSTRAP" \
    --describe \
    --group "$GROUP" 2>/dev/null)

  read -r TOTAL_CONSUMED TOTAL_PRODUCED TOTAL_LAG <<< "$(echo "$OUTPUT" | awk '
    NR>1 && $4 ~ /^[0-9]+$/ && $5 ~ /^[0-9]+$/ && $6 ~ /^[0-9]+$/ {
      consumed += $4; produced += $5; lag += $6
    }
    END { print consumed+0, produced+0, lag+0 }
  ')"

  TIMESTAMP=$(date '+%H:%M:%S')

  printf "\033[K[%s] group=%s  produced=%s  consumed=%s  lag=%s\n" \
    "$TIMESTAMP" "$GROUP" \
    "$(compact "$TOTAL_PRODUCED")" \
    "$(compact "$TOTAL_CONSUMED")" \
    "$(compact "$TOTAL_LAG")"

  sleep "$INTERVAL"
done
