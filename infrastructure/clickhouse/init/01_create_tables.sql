CREATE DATABASE IF NOT EXISTS analytics;

-- Events table (main data store)
CREATE TABLE
    IF NOT EXISTS analytics.events (
        event_id String,
        tenant_id String,
        user_id String,
        session_id String,
        event_name LowCardinality (String),
        `timestamp` DateTime64 (3),
        `date` Date,
        -- Standard dimensions
        country LowCardinality (String),
        continent LowCardinality (String),
        region LowCardinality (String),
        `state` String,
        city String,
        device_type LowCardinality (String),
        platform LowCardinality (String),
        browser LowCardinality (String),
        browser_version String,
        os LowCardinality (String),
        os_version String,
        -- Custom properties (flexible schema)
        props_str Map (String, String),
        props_num Map (String, Float64),
        props_bool Map (String, UInt8),
        -- Metadata
        ip_address IPv4,
        user_agent String,
        INDEX idx_event_name event_name TYPE bloom_filter GRANULARITY 1,
        INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (`date`)
ORDER BY
    (
        tenant_id,
        `date`,
        event_name,
        user_id,
        `timestamp`
    ) TTL `date` + INTERVAL 90 DAY SETTINGS index_granularity = 8192;

-- Users table (aggregated user data)
CREATE TABLE
    IF NOT EXISTS analytics.users (
        tenant_id String,
        user_id String,
        first_seen DateTime64 (3),
        last_seen DateTime64 (3),
        total_events UInt64,
        props_str Map (String, String),
        props_num Map (String, Float64),
        props_bool Map (String, UInt8),
        updated_at DateTime64 (3)
    ) ENGINE = ReplacingMergeTree (updated_at)
ORDER BY
    (tenant_id, user_id);

-- Daily metrics (pre-aggregated for performance)
CREATE TABLE
    IF NOT EXISTS analytics.metrics_daily (
        tenant_id String,
        `date` Date,
        metric_type LowCardinality (String),
        dimension_name LowCardinality (String),
        dimension_value String,
        event_count UInt64,
        unique_users AggregateFunction (uniq, String)
    ) ENGINE = AggregatingMergeTree ()
PARTITION BY
    toYYYYMM (`date`)
ORDER BY
    (
        tenant_id,
        `date`,
        metric_type,
        dimension_name,
        dimension_value
    );

-- Property metadata (tracks all properties seen)
CREATE TABLE
    IF NOT EXISTS analytics.property_metadata (
        tenant_id String,
        property_name String,
        property_type LowCardinality (String),
        first_seen DateTime64 (3),
        last_seen DateTime64 (3),
        event_count UInt64,
        example_value String,
        updated_at DateTime64 (3)
    ) ENGINE = ReplacingMergeTree (updated_at)
ORDER BY
    (tenant_id, property_name);