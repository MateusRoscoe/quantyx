#!/usr/bin/env bash
#
# Shows Kafka consumer group lag (how far behind each partition is).
# Runs kafka-consumer-groups.sh inside the Kafka container.
#
set -euo pipefail

GROUP="${1:-consumer-events-ingest-group}"
CONTAINER_NAME="${2:-kafka}"
BOOTSTRAP="${3:-kafka:9092}"

docker compose exec "$CONTAINER_NAME" /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server "$BOOTSTRAP" \
  --describe \
  --group "$GROUP"
