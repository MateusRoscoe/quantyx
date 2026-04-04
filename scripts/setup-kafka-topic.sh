#!/usr/bin/env bash
#
# Kafka topic setup script — creates or reconfigures a topic.
# Uses the Kafka CLI tools (kafka-topics.sh / kafka-configs.sh).
#
# If the CLI tools aren't installed locally, they're run via
# `docker run --rm` with the apache/kafka image.
#
# Usage:
#   ./scripts/setup-kafka-topic.sh [options]
#
# Options:
#   --brokers               Bootstrap servers (default: KAFKA_BROKERS env or localhost:29092)
#   --topic                 Topic name (default: event-webhook-ingestion)
#   --partitions            Number of partitions (default: 12)
#   --replication-factor    Replication factor (default: 1)
#   --min-isr               Minimum in-sync replicas (default: 1)
#   --retention-ms          Retention in ms (default: 259200000 = 3 days)
#   --retention-bytes       Max bytes per partition, -1 = unlimited (default: -1)
#   --segment-bytes         Log segment size (default: 104857600 = 100 MB)
#   --compression           Compression: producer|none|gzip|snappy|lz4|zstd (default: producer)
#   --max-message-bytes     Max message size (default: 10485760 = 10 MB)
#   --cleanup-policy        Cleanup policy: delete|compact (default: delete)
#   --docker-network        Docker network for docker-run mode (default: quantyx-net)
#   --kafka-image           Kafka image for docker-run mode (default: apache/kafka:4.1.1)
#   --dry-run               Show commands without executing

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────

BROKERS="${KAFKA_BROKERS:-localhost:29092}"
TOPIC="event-webhook-ingestion"
PARTITIONS=12
REPLICATION_FACTOR=1
MIN_ISR=1
RETENTION_MS=259200000
RETENTION_BYTES=-1
SEGMENT_BYTES=104857600
COMPRESSION="producer"
MAX_MESSAGE_BYTES=10485760
CLEANUP_POLICY="delete"
DOCKER_NETWORK="quantyx-net"
KAFKA_IMAGE="apache/kafka:4.1.1"
DRY_RUN=false

# ── Parse args ───────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --brokers)            BROKERS="$2";            shift 2 ;;
    --topic)              TOPIC="$2";              shift 2 ;;
    --partitions)         PARTITIONS="$2";         shift 2 ;;
    --replication-factor) REPLICATION_FACTOR="$2"; shift 2 ;;
    --min-isr)            MIN_ISR="$2";            shift 2 ;;
    --retention-ms)       RETENTION_MS="$2";       shift 2 ;;
    --retention-bytes)    RETENTION_BYTES="$2";    shift 2 ;;
    --segment-bytes)      SEGMENT_BYTES="$2";      shift 2 ;;
    --compression)        COMPRESSION="$2";        shift 2 ;;
    --max-message-bytes)  MAX_MESSAGE_BYTES="$2";  shift 2 ;;
    --cleanup-policy)     CLEANUP_POLICY="$2";     shift 2 ;;
    --docker-network)     DOCKER_NETWORK="$2";     shift 2 ;;
    --kafka-image)        KAFKA_IMAGE="$2";        shift 2 ;;
    --dry-run)            DRY_RUN=true;            shift   ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ── Resolve CLI tool runner ──────────────────────────────────────────────────

# Prefer local kafka-topics.sh, fall back to docker run
if command -v kafka-topics.sh &>/dev/null; then
  run_kafka() { "$@"; }
elif command -v kafka-topics &>/dev/null; then
  # Some installs drop the .sh suffix
  run_kafka() {
    local cmd="$1"; shift
    cmd="${cmd%.sh}"
    "$cmd" "$@"
  }
else
  run_kafka() {
    local cmd="$1"; shift
    docker run --rm --network "$DOCKER_NETWORK" "$KAFKA_IMAGE" "/opt/kafka/bin/$cmd" "$@"
  }
fi

run_cmd() {
  echo "  \$ $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] skipped"
    return 0
  fi
  run_kafka "$@"
}

# ── Config string ────────────────────────────────────────────────────────────

TOPIC_CONFIG="min.insync.replicas=${MIN_ISR}"
TOPIC_CONFIG+=",retention.ms=${RETENTION_MS}"
TOPIC_CONFIG+=",retention.bytes=${RETENTION_BYTES}"
TOPIC_CONFIG+=",segment.bytes=${SEGMENT_BYTES}"
TOPIC_CONFIG+=",compression.type=${COMPRESSION}"
TOPIC_CONFIG+=",max.message.bytes=${MAX_MESSAGE_BYTES}"
TOPIC_CONFIG+=",cleanup.policy=${CLEANUP_POLICY}"

# ── Print config ─────────────────────────────────────────────────────────────

echo "Topic configuration:"
echo "  brokers:            ${BROKERS}"
echo "  topic:              ${TOPIC}"
echo "  partitions:         ${PARTITIONS}"
echo "  replication-factor: ${REPLICATION_FACTOR}"
echo "  min.insync.replicas ${MIN_ISR}"
echo "  retention.ms        ${RETENTION_MS}"
echo "  retention.bytes     ${RETENTION_BYTES}"
echo "  segment.bytes       ${SEGMENT_BYTES}"
echo "  compression.type    ${COMPRESSION}"
echo "  max.message.bytes   ${MAX_MESSAGE_BYTES}"
echo "  cleanup.policy      ${CLEANUP_POLICY}"
echo ""

# ── Check if topic exists ────────────────────────────────────────────────────

echo "Checking if topic exists..."
EXISTING=$(run_kafka kafka-topics.sh --bootstrap-server "$BROKERS" --list 2>/dev/null | grep -x "$TOPIC" || true)

if [[ -z "$EXISTING" ]]; then
  # ── Create topic ─────────────────────────────────────────────────────────

  echo "Topic \"${TOPIC}\" does not exist. Creating..."
  run_cmd kafka-topics.sh \
    --bootstrap-server "$BROKERS" \
    --create \
    --topic "$TOPIC" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION_FACTOR" \
    --config "min.insync.replicas=${MIN_ISR}" \
    --config "retention.ms=${RETENTION_MS}" \
    --config "retention.bytes=${RETENTION_BYTES}" \
    --config "segment.bytes=${SEGMENT_BYTES}" \
    --config "compression.type=${COMPRESSION}" \
    --config "max.message.bytes=${MAX_MESSAGE_BYTES}" \
    --config "cleanup.policy=${CLEANUP_POLICY}"
  echo ""
else
  echo "Topic \"${TOPIC}\" exists."

  # ── Check current partitions ───────────────────────────────────────────

  CURRENT_PARTITIONS=$(run_kafka kafka-topics.sh --bootstrap-server "$BROKERS" --describe --topic "$TOPIC" 2>/dev/null \
    | head -1 | grep -o 'PartitionCount:[[:space:]]*[0-9]*' | grep -o '[0-9]*')

  if [[ -n "$CURRENT_PARTITIONS" ]]; then
    echo "Current partitions: ${CURRENT_PARTITIONS}"
    if (( PARTITIONS > CURRENT_PARTITIONS )); then
      echo "Increasing partitions to ${PARTITIONS}..."
      run_cmd kafka-topics.sh \
        --bootstrap-server "$BROKERS" \
        --alter \
        --topic "$TOPIC" \
        --partitions "$PARTITIONS"
    elif (( PARTITIONS < CURRENT_PARTITIONS )); then
      echo "WARNING: Requested ${PARTITIONS} but topic has ${CURRENT_PARTITIONS}. Cannot decrease. Skipping."
    else
      echo "Partition count already at ${PARTITIONS}."
    fi
  fi

  # ── Apply topic config ─────────────────────────────────────────────────

  echo "Applying topic configuration..."
  run_cmd kafka-configs.sh \
    --bootstrap-server "$BROKERS" \
    --entity-type topics \
    --entity-name "$TOPIC" \
    --alter \
    --add-config "$TOPIC_CONFIG"
  echo ""
fi

# ── Verify ─────────────────────────────────────────────────────────────────

if [[ "$DRY_RUN" != "true" ]]; then
  echo "Final state:"
  run_kafka kafka-topics.sh --bootstrap-server "$BROKERS" --describe --topic "$TOPIC"
fi

echo ""
echo "Done."
