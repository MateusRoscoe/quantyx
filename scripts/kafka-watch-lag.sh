#!/usr/bin/env bash
#
# Watches Kafka consumer group lag, reporting total lag across all partitions.
# Refreshes every INTERVAL seconds (default: 2).
#
set -euo pipefail

GROUP="${1:-consumer-events-ingest-group}"
INTERVAL="${2:-20}"
CONTAINER_NAME="${3:-kafka}"
BOOTSTRAP="${4:-kafka:9092}"

while true; do
  OUTPUT=$(docker compose exec -T "$CONTAINER_NAME" /opt/kafka/bin/kafka-consumer-groups.sh \
    --bootstrap-server "$BOOTSTRAP" \
    --describe \
    --group "$GROUP" 2>/dev/null)

  compact() {
    awk -v n="$1" 'BEGIN {
      if (n >= 1000000000) printf "%.1fB", n/1000000000
      else if (n >= 1000000) printf "%.1fM", n/1000000
      else if (n >= 1000) printf "%.1fk", n/1000
      else printf "%d", n
    }'
  }

  TOTAL_LAG=$(echo "$OUTPUT" | awk 'NR>1 && $6 ~ /^[0-9]+$/ { sum += $6 } END { print sum+0 }')
  PARTITIONS=$(echo "$OUTPUT" | awk 'NR>1 && $6 ~ /^[0-9]+$/ { count++ } END { print count+0 }')
  PER_PARTITION=$(echo "$OUTPUT" | awk 'NR>1 && $6 ~ /^[0-9]+$/ { print $4, $6 }' | while read -r p lag; do
    printf "P%s:%s " "$p" "$(compact "$lag")"
  done)
  TIMESTAMP=$(date '+%H:%M:%S')

  printf "\033[K[%s] group=%s  total=%s\n\033[K  [%s]\n" "$TIMESTAMP" "$GROUP" "$(compact "$TOTAL_LAG")" "${PER_PARTITION% }"

  sleep "$INTERVAL"
done
