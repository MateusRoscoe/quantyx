CREATE DATABASE IF NOT EXISTS analytics;

-- Events table (main data store)
CREATE TABLE
    IF NOT EXISTS analytics.events (
        event_id String CODEC(ZSTD(1)),
        project_id String,
        user_id String CODEC(ZSTD(1)),
        session_id String CODEC(ZSTD(1)),
        event_name LowCardinality (String),
        `timestamp` DateTime CODEC(DoubleDelta, ZSTD(1)),
        -- Standard dimensions
        country LowCardinality (String),
        continent LowCardinality (String),
        region LowCardinality (String),
        `state` LowCardinality (String),
        city String CODEC(ZSTD(1)),
        latitude Float64 DEFAULT 0 CODEC(ZSTD(1)),
        longitude Float64 DEFAULT 0 CODEC(ZSTD(1)),
        device_type LowCardinality (String),
        platform LowCardinality (String),
        browser LowCardinality (String),
        browser_version LowCardinality (String),
        os LowCardinality (String),
        os_version LowCardinality (String),
        path String DEFAULT '' CODEC(ZSTD(3)),
        -- Custom properties (flexible schema)
        props_str Map (String, String),
        props_num Map (String, Float64),
        props_bool Map (String, UInt8),
        -- Metadata
        ip_address IPv6 CODEC(ZSTD(1)),
        user_agent String CODEC(ZSTD(5)),
        INDEX idx_event_name event_name TYPE bloom_filter GRANULARITY 1,
        INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_session_id session_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_path path TYPE bloom_filter GRANULARITY 1
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (`timestamp`)
ORDER BY
    (project_id, `timestamp`)
TTL `timestamp` + INTERVAL 14 MONTH
SETTINGS index_granularity = 8192,
    non_replicated_deduplication_window = 1000,
    ttl_only_drop_parts = 1;

-- Users table (aggregated user data)
CREATE TABLE
    IF NOT EXISTS analytics.users (
        project_id String,
        user_id String,
        first_seen AggregateFunction (min, DateTime),
        last_seen AggregateFunction (max, DateTime),
        total_events AggregateFunction (sum, UInt64),
        props_str AggregateFunction (anyLast, Map(String, String)),
        props_num AggregateFunction (anyLast, Map(String, Float64)),
        props_bool AggregateFunction (anyLast, Map(String, UInt8)),
        updated_at AggregateFunction (max, DateTime)
    ) ENGINE = AggregatingMergeTree ()
ORDER BY
    (project_id, user_id);

-- Hourly metrics (pre-aggregated for performance, supports timezone-aware queries)
CREATE TABLE
    IF NOT EXISTS analytics.metrics_hourly (
        project_id String,
        hour DateTime,
        metric_type LowCardinality (String),
        dimension_name LowCardinality (String),
        dimension_value String,
        event_count AggregateFunction (sum, UInt64),
        unique_users AggregateFunction (uniq, String)
    ) ENGINE = AggregatingMergeTree ()
PARTITION BY
    toYYYYMM (hour)
ORDER BY
    (
        project_id,
        dimension_name,
        hour,
        metric_type,
        dimension_value
    );

-- Property metadata (tracks all properties seen)
CREATE TABLE
    IF NOT EXISTS analytics.property_metadata (
        project_id String,
        property_name String,
        property_type LowCardinality (String),
        first_seen AggregateFunction (min, DateTime),
        last_seen AggregateFunction (max, DateTime),
        event_count AggregateFunction (sum, UInt64),
        unique_values AggregateFunction (uniq, String),
        example_value AggregateFunction (any, String),
        updated_at AggregateFunction (max, DateTime)
    ) ENGINE = AggregatingMergeTree ()
ORDER BY
    (project_id, property_name, property_type);

-- Property metadata watermark (tracks last processed hour for scheduled backfill)
CREATE TABLE
    IF NOT EXISTS analytics.property_metadata_watermark (
        job_name String,
        last_processed_hour DateTime
    ) ENGINE = ReplacingMergeTree ()
ORDER BY
    (job_name);

-- Sessions table (aggregated per-session data)
CREATE TABLE
    IF NOT EXISTS analytics.sessions (
        project_id String,
        session_id String,
        user_id AggregateFunction (max, String),
        started_at AggregateFunction (min, DateTime),
        ended_at AggregateFunction (max, DateTime),
        total_events AggregateFunction (sum, UInt64),
        page_views AggregateFunction (sum, UInt64),
        browser AggregateFunction (any, String),
        os AggregateFunction (any, String),
        device_type AggregateFunction (any, String),
        country AggregateFunction (any, String),
        continent AggregateFunction (any, String),
        region AggregateFunction (any, String)
    ) ENGINE = AggregatingMergeTree ()
ORDER BY
    (project_id, session_id);

-- Sessions daily (denormalized for date-filtered list queries)
CREATE TABLE
    IF NOT EXISTS analytics.sessions_daily (
        project_id String,
        session_id String,
        user_id String,
        started_at DateTime,
        ended_at DateTime,
        total_events UInt64,
        page_views UInt64,
        browser LowCardinality (String),
        os LowCardinality (String),
        device_type LowCardinality (String),
        country LowCardinality (String),
        continent LowCardinality (String),
        region LowCardinality (String)
    ) ENGINE = ReplacingMergeTree (ended_at)
PARTITION BY
    toYYYYMM (started_at)
ORDER BY
    (project_id, started_at, session_id);

-- Session-user lookup (maps user_id → session_ids for fast user-scoped queries)
CREATE TABLE
    IF NOT EXISTS analytics.session_user_map (
        project_id String,
        user_id String,
        session_id String
    ) ENGINE = ReplacingMergeTree ()
ORDER BY
    (project_id, user_id, session_id);

-- Geographic metrics (pre-aggregated for cross-dimension geo drill-down)
CREATE TABLE
    IF NOT EXISTS analytics.metrics_geo (
        project_id String,
        hour DateTime,
        continent LowCardinality (String),
        country LowCardinality (String),
        region LowCardinality (String),
        state LowCardinality (String),
        city String CODEC(ZSTD(1)),
        event_count AggregateFunction (sum, UInt64),
        unique_users AggregateFunction (uniq, String)
    ) ENGINE = AggregatingMergeTree ()
PARTITION BY
    toYYYYMM (hour)
ORDER BY
    (project_id, hour, continent, country, region, city);

-- City coordinates (representative lat/lon per city for point-on-map)
CREATE TABLE
    IF NOT EXISTS analytics.city_coordinates (
        project_id String,
        city String,
        country LowCardinality (String),
        latitude AggregateFunction (any, Float64),
        longitude AggregateFunction (any, Float64),
        event_count AggregateFunction (sum, UInt64)
    ) ENGINE = AggregatingMergeTree ()
ORDER BY
    (project_id, city, country);

-- ════════════════════════════════════════════════
-- Materialized Views
-- ════════════════════════════════════════════════

-- MV 1: Aggregate per-user stats from events
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_users
TO analytics.users
AS
SELECT
    project_id,
    user_id,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS total_events,
    anyLastState(props_str) AS props_str,
    anyLastState(props_num) AS props_num,
    anyLastState(props_bool) AS props_bool,
    maxState(timestamp) AS updated_at
FROM analytics.events
WHERE user_id != ''
GROUP BY project_id, user_id;

-- MV: Aggregate per-session stats from events
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_sessions
TO analytics.sessions
AS
SELECT
    project_id,
    session_id,
    maxState(user_id) AS user_id,
    minState(timestamp) AS started_at,
    maxState(timestamp) AS ended_at,
    sumState(toUInt64(1)) AS total_events,
    sumState(toUInt64(if(event_name = 'page_view', 1, 0))) AS page_views,
    anyState(browser) AS browser,
    anyState(os) AS os,
    anyState(device_type) AS device_type,
    anyState(country) AS country,
    anyState(continent) AS continent,
    anyState(region) AS region
FROM analytics.events
WHERE session_id != ''
GROUP BY project_id, session_id;

-- MV: Denormalized sessions for date-filtered list queries
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_sessions_daily
TO analytics.sessions_daily
AS
SELECT
    project_id,
    session_id,
    max(user_id) AS user_id,
    min(timestamp) AS started_at,
    max(timestamp) AS ended_at,
    toUInt64(count()) AS total_events,
    toUInt64(countIf(event_name = 'page_view')) AS page_views,
    any(browser) AS browser,
    any(os) AS os,
    any(device_type) AS device_type,
    any(country) AS country,
    any(continent) AS continent,
    any(region) AS region
FROM analytics.events
WHERE session_id != ''
GROUP BY project_id, session_id;

-- MV: Populate session-user lookup
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_session_user_map
TO analytics.session_user_map
AS
SELECT
    project_id,
    user_id,
    session_id
FROM analytics.events
WHERE session_id != '' AND user_id != '';

-- MV: Hourly metrics — one MV per dimension (ClickHouse processes each independently)

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_overall
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'overall' AS dimension_name,
    '' AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
GROUP BY project_id, hour;

-- MV: Consolidated metrics for all standard dimensions (replaces 10 individual dimension MVs)
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_all
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    dim.1 AS dimension_name,
    dim.2 AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
ARRAY JOIN
    arrayFilter(
        x -> x.2 != '',
        [
            ('event_name', event_name),
            ('browser', browser),
            ('os', os),
            ('device_type', device_type),
            ('platform', platform),
            ('country', country),
            ('continent', continent),
            ('region', region),
            ('city', city),
            ('state', state)
        ]
    ) AS dim
GROUP BY project_id, hour, dim.1, dim.2;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_city_coordinates
TO analytics.city_coordinates
AS
SELECT
    project_id,
    city,
    country,
    anyState(events.latitude) AS latitude,
    anyState(events.longitude) AS longitude,
    sumState(toUInt64(1)) AS event_count
FROM analytics.events AS events
WHERE city != '' AND events.latitude != 0 AND events.longitude != 0
GROUP BY project_id, city, country;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_path
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'path' AS dimension_name,
    path AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE event_name = 'page_view' AND path != ''
GROUP BY project_id, hour, path;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_geo
TO analytics.metrics_geo
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    continent,
    country,
    region,
    state,
    city,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE continent != ''
GROUP BY project_id, hour, continent, country, region, state, city;

-- Property metadata is populated by the scheduler-analytics app (watermark-based backfill),
-- not by materialized views. See FIXES.md for rationale.
