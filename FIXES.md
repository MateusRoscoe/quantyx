# Known Issues

## `property_metadata` watermark skips late arrivals

The `scheduler-analytics` property metadata backfill (`services/property-metadata.ts`) uses a one-directional watermark. It processes events by `timestamp` range, advancing the watermark forward after each chunk. Once the watermark passes hour H, any event with `timestamp` in hour H that arrives in ClickHouse later is permanently skipped — the watermark never goes backwards.

Consequences: `property_metadata` undercounts `event_count`, `unique_values`, and may miss `first_seen`/`last_seen` boundaries for properties that appear primarily in late-arriving events. Since users can send stale events (minutes/hours/days old due to SDK buffering), any property metadata derived from those events is lost.
