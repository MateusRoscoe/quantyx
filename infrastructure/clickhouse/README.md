# ClickHouse Infrastructure

## Data Retention

Raw events have a 90-day TTL (`TTL timestamp + INTERVAL 90 DAY`). After expiry, rows are dropped during background merges. Aggregate tables have no TTL — historical trends survive beyond raw event retention.

If a materialized view is added or changed after raw events have expired, those events cannot be backfilled into the new aggregates. Create new MVs before you need the data.

## Cold Storage (future)

ClickHouse supports tiered storage via storage policies. Raw events can be moved to S3/GCS before deletion, keeping them queryable at higher latency without local disk cost.

**Storage policy configuration** (in ClickHouse server config):

```xml
<storage_configuration>
  <disks>
    <hot>
      <path>/var/lib/clickhouse/</path>
    </hot>
    <cold>
      <type>s3</type>
      <endpoint>https://bucket.s3.amazonaws.com/data/</endpoint>
      <access_key_id>...</access_key_id>
      <secret_access_key>...</secret_access_key>
    </cold>
  </disks>
  <policies>
    <tiered>
      <volumes>
        <hot><disk>hot</disk></hot>
        <cold><disk>cold</disk></cold>
      </volumes>
      <move_factor>0.2</move_factor>
    </tiered>
  </policies>
</storage_configuration>
```

**Table-level TTL with tiering:**

```sql
TTL timestamp + INTERVAL 30 DAY TO VOLUME 'cold',
    timestamp + INTERVAL 365 DAY DELETE
SETTINGS storage_policy = 'tiered';
```

This keeps raw events on local SSD for 30 days, moves them to S3 for up to a year, then deletes. Data on S3 is still queryable with normal SQL — ClickHouse fetches it transparently, just with higher latency. No application changes needed — just config and a TTL update on the events table.
