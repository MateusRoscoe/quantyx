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
-- Properties come only from $identify/$server_identify events.
-- Regular track() events contribute to counts/timestamps but NOT properties.
CREATE TABLE
    IF NOT EXISTS analytics.users (
        project_id String,
        user_id String,
        first_seen SimpleAggregateFunction (min, DateTime),
        last_seen SimpleAggregateFunction (max, DateTime),
        total_events SimpleAggregateFunction (sum, UInt64),
        -- SDK-set properties (from $identify)
        props_str AggregateFunction (argMax, Map(String, String), DateTime),
        props_num AggregateFunction (argMax, Map(String, Float64), DateTime),
        props_bool AggregateFunction (argMax, Map(String, UInt8), DateTime),
        -- Server-set properties (from $server_identify)
        server_props_str AggregateFunction (argMax, Map(String, String), DateTime),
        server_props_num AggregateFunction (argMax, Map(String, Float64), DateTime),
        server_props_bool AggregateFunction (argMax, Map(String, UInt8), DateTime),
        updated_at SimpleAggregateFunction (max, DateTime)
    ) ENGINE = AggregatingMergeTree ()
PARTITION BY
    toYYYYMM (last_seen)
ORDER BY
    (project_id, user_id)
TTL last_seen + INTERVAL 3 YEAR
SETTINGS ttl_only_drop_parts = 1;

-- Groups table (aggregated group data)
-- Group identity is extracted from props_str['$group_type'] and props_str['$group_id'].
CREATE TABLE
    IF NOT EXISTS analytics.groups (
        project_id String,
        group_type String,
        group_id String,
        first_seen SimpleAggregateFunction (min, DateTime),
        last_seen SimpleAggregateFunction (max, DateTime),
        -- SDK-set properties (from $group_identify)
        props_str AggregateFunction (argMax, Map(String, String), DateTime),
        props_num AggregateFunction (argMax, Map(String, Float64), DateTime),
        props_bool AggregateFunction (argMax, Map(String, UInt8), DateTime),
        -- Server-set properties (from $server_group_identify)
        server_props_str AggregateFunction (argMax, Map(String, String), DateTime),
        server_props_num AggregateFunction (argMax, Map(String, Float64), DateTime),
        server_props_bool AggregateFunction (argMax, Map(String, UInt8), DateTime),
        member_count AggregateFunction (uniqExact, String),
        updated_at SimpleAggregateFunction (max, DateTime)
    ) ENGINE = AggregatingMergeTree ()
PARTITION BY
    toYYYYMM (last_seen)
ORDER BY
    (project_id, group_type, group_id)
TTL last_seen + INTERVAL 3 YEAR
SETTINGS ttl_only_drop_parts = 1;

-- User-group membership (maps user_id → group_type/group_id)
CREATE TABLE
    IF NOT EXISTS analytics.user_groups (
        project_id String,
        user_id String,
        group_type String,
        group_id String,
        assigned_at SimpleAggregateFunction (min, DateTime)
    ) ENGINE = AggregatingMergeTree ()
ORDER BY
    (project_id, user_id, group_type, group_id);

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
    )
TTL hour + INTERVAL 3 YEAR
SETTINGS ttl_only_drop_parts = 1;

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
-- Uses MergeTree (not AggregatingMergeTree) so started_at can be a plain DateTime
-- in ORDER BY and PARTITION BY. ClickHouse 26+ forbids SimpleAggregateFunction in
-- key expressions. Trade-off: multiple rows per session (one per Kafka batch,
-- typically 2-5), but the query already does GROUP BY session_id to merge them.
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
        region LowCardinality (String),
        INDEX idx_started_at started_at TYPE minmax GRANULARITY 1
    ) ENGINE = MergeTree ()
PARTITION BY
    toYYYYMM (started_at)
ORDER BY
    (project_id, started_at, session_id)
TTL started_at + INTERVAL 3 YEAR
SETTINGS ttl_only_drop_parts = 1;

-- NOTE: session_user_map table and mv_session_user_map were removed.
-- User→session lookups are handled by filtering sessions_daily directly.

-- Session properties (separate from sessions table for write efficiency)
-- Only populated by $session_set/$server_session_set events via dedicated MV.
CREATE TABLE
    IF NOT EXISTS analytics.session_properties (
        project_id String,
        session_id String,
        -- SDK-set properties (from $session_set)
        props_str AggregateFunction (argMax, Map(String, String), DateTime),
        props_num AggregateFunction (argMax, Map(String, Float64), DateTime),
        props_bool AggregateFunction (argMax, Map(String, UInt8), DateTime),
        -- Server-set properties (from $server_session_set)
        server_props_str AggregateFunction (argMax, Map(String, String), DateTime),
        server_props_num AggregateFunction (argMax, Map(String, Float64), DateTime),
        server_props_bool AggregateFunction (argMax, Map(String, UInt8), DateTime)
    ) ENGINE = AggregatingMergeTree ()
ORDER BY
    (project_id, session_id);

-- User name lookup (latest name from $identify or $server_identify)
CREATE TABLE
    IF NOT EXISTS analytics.user_names (
        project_id String,
        user_id String,
        name String,
        updated_at DateTime
    ) ENGINE = ReplacingMergeTree (updated_at)
ORDER BY
    (project_id, user_id);

-- Group name lookup (latest name from $group_identify or $server_group_identify)
CREATE TABLE
    IF NOT EXISTS analytics.group_names (
        project_id String,
        group_type String,
        group_id String,
        name String,
        updated_at DateTime
    ) ENGINE = ReplacingMergeTree (updated_at)
ORDER BY
    (project_id, group_type, group_id);

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
    (project_id, hour, continent, country, region, city)
TTL hour + INTERVAL 3 YEAR
SETTINGS ttl_only_drop_parts = 1;

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

-- MV: Aggregate per-user stats from events.
-- Properties come ONLY from $identify/$server_identify events (via argMaxStateIf combinator).
-- Regular track() events update counts/timestamps but NOT properties.
-- When no matching events exist in a batch, the -If combinator produces an empty aggregate state
-- that loses during AggregatingMergeTree merges.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_users
TO analytics.users
AS
SELECT
    e.project_id,
    e.user_id,
    min(e.timestamp) AS first_seen,
    max(e.timestamp) AS last_seen,
    toUInt64(countIf(e.event_name NOT LIKE '$%')) AS total_events,
    -- SDK properties: only from $identify
    argMaxStateIf(e.props_str, e.timestamp, e.event_name = '$identify') AS props_str,
    argMaxStateIf(e.props_num, e.timestamp, e.event_name = '$identify') AS props_num,
    argMaxStateIf(e.props_bool, e.timestamp, e.event_name = '$identify') AS props_bool,
    -- Server properties: only from $server_identify
    argMaxStateIf(e.props_str, e.timestamp, e.event_name = '$server_identify') AS server_props_str,
    argMaxStateIf(e.props_num, e.timestamp, e.event_name = '$server_identify') AS server_props_num,
    argMaxStateIf(e.props_bool, e.timestamp, e.event_name = '$server_identify') AS server_props_bool,
    max(e.timestamp) AS updated_at
FROM analytics.events AS e
WHERE e.user_id != ''
GROUP BY e.project_id, e.user_id;

-- MV: Aggregate per-group stats from events.
-- Extracts group_type/group_id from props_str reserved keys ($group_type, $group_id).
-- Strips identity keys from stored properties via mapFilter.
-- Also processes $group_assign to create group entries on membership assignment.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_groups
TO analytics.groups
AS
SELECT
    e.project_id,
    e.props_str['$group_type'] AS group_type,
    e.props_str['$group_id'] AS group_id,
    min(e.timestamp) AS first_seen,
    max(e.timestamp) AS last_seen,
    -- SDK properties: only from $group_identify
    argMaxStateIf(
        mapFilter((k, v) -> k NOT IN ('$group_type', '$group_id'), e.props_str),
        e.timestamp,
        e.event_name = '$group_identify'
    ) AS props_str,
    argMaxStateIf(e.props_num, e.timestamp, e.event_name = '$group_identify') AS props_num,
    argMaxStateIf(e.props_bool, e.timestamp, e.event_name = '$group_identify') AS props_bool,
    -- Server properties: only from $server_group_identify
    argMaxStateIf(
        mapFilter((k, v) -> k NOT IN ('$group_type', '$group_id'), e.props_str),
        e.timestamp,
        e.event_name = '$server_group_identify'
    ) AS server_props_str,
    argMaxStateIf(e.props_num, e.timestamp, e.event_name = '$server_group_identify') AS server_props_num,
    argMaxStateIf(e.props_bool, e.timestamp, e.event_name = '$server_group_identify') AS server_props_bool,
    uniqExactStateIf(e.user_id, e.event_name = '$group_assign' AND e.user_id != '') AS member_count,
    max(e.timestamp) AS updated_at
FROM analytics.events AS e
WHERE e.event_name IN ('$group_identify', '$server_group_identify', '$group_assign')
  AND e.props_str['$group_type'] != '' AND e.props_str['$group_id'] != ''
GROUP BY e.project_id, group_type, group_id;

-- MV: Populate user-group membership from $group_assign events.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_user_groups
TO analytics.user_groups
AS
SELECT
    project_id,
    user_id,
    props_str['$group_type'] AS group_type,
    props_str['$group_id'] AS group_id,
    min(timestamp) AS assigned_at
FROM analytics.events
WHERE event_name = '$group_assign'
  AND user_id != ''
  AND props_str['$group_type'] != '' AND props_str['$group_id'] != ''
GROUP BY project_id, user_id, group_type, group_id;

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
    sumState(toUInt64(if(event_name NOT LIKE '$%', 1, 0))) AS total_events,
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
    toUInt64(countIf(event_name NOT LIKE '$%')) AS total_events,
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

-- MV: Aggregate session properties from $session_set/$server_session_set events only.
-- Separate from mv_sessions to avoid write amplification on regular events.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_session_properties
TO analytics.session_properties
AS
SELECT
    e.project_id,
    e.session_id,
    argMaxStateIf(e.props_str, e.timestamp, e.event_name = '$session_set') AS props_str,
    argMaxStateIf(e.props_num, e.timestamp, e.event_name = '$session_set') AS props_num,
    argMaxStateIf(e.props_bool, e.timestamp, e.event_name = '$session_set') AS props_bool,
    argMaxStateIf(e.props_str, e.timestamp, e.event_name = '$server_session_set') AS server_props_str,
    argMaxStateIf(e.props_num, e.timestamp, e.event_name = '$server_session_set') AS server_props_num,
    argMaxStateIf(e.props_bool, e.timestamp, e.event_name = '$server_session_set') AS server_props_bool
FROM analytics.events AS e
WHERE e.event_name IN ('$session_set', '$server_session_set')
  AND e.session_id != ''
GROUP BY e.project_id, e.session_id;

-- MV: Hourly metrics — consolidated overall, standard dimensions, and path.
-- System events ($%) excluded. One MV replaces three (mv_metrics_overall,
-- mv_metrics_all, mv_metrics_path) to reduce write amplification.
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
        arrayConcat(
            [
                ('overall', '_'),
                ('event_name', event_name),
                ('browser', browser),
                ('os', os),
                ('device_type', device_type),
                ('platform', platform),
                ('country', country),
                ('continent', continent),
                ('region', region),
                ('city', city)
            ],
            if(event_name = 'page_view' AND path != '', [('path', path)], [])
        )
    ) AS dim
WHERE event_name NOT LIKE '$%'
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
  AND event_name NOT LIKE '$%'
GROUP BY project_id, city, country;

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
WHERE continent != '' AND event_name NOT LIKE '$%'
GROUP BY project_id, hour, continent, country, region, state, city;

-- MV: Populate user name lookup from identify events
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_user_names
TO analytics.user_names
AS
SELECT
    project_id,
    user_id,
    props_str['name'] AS name,
    timestamp AS updated_at
FROM analytics.events
WHERE event_name IN ('$identify', '$server_identify')
  AND user_id != ''
  AND props_str['name'] != '';

-- MV: Populate group name lookup from group identify events
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_group_names
TO analytics.group_names
AS
SELECT
    project_id,
    props_str['$group_type'] AS group_type,
    props_str['$group_id'] AS group_id,
    props_str['name'] AS name,
    timestamp AS updated_at
FROM analytics.events
WHERE event_name IN ('$group_identify', '$server_group_identify')
  AND props_str['$group_type'] != ''
  AND props_str['$group_id'] != ''
  AND props_str['name'] != '';

-- Property metadata is populated by the scheduler-analytics app (watermark-based backfill),
-- not by materialized views. See FIXES.md for rationale.
