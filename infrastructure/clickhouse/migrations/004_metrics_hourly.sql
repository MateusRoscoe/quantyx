-- Migration: Replace metrics_daily with metrics_hourly
-- Enables timezone-aware filtering and hourly chart granularity

-- Drop all 8 daily metrics MVs
DROP VIEW IF EXISTS analytics.mv_metrics_overall;
DROP VIEW IF EXISTS analytics.mv_metrics_event_name;
DROP VIEW IF EXISTS analytics.mv_metrics_browser;
DROP VIEW IF EXISTS analytics.mv_metrics_os;
DROP VIEW IF EXISTS analytics.mv_metrics_device_type;
DROP VIEW IF EXISTS analytics.mv_metrics_platform;
DROP VIEW IF EXISTS analytics.mv_metrics_country;
DROP VIEW IF EXISTS analytics.mv_metrics_path;

-- Drop the daily table
DROP TABLE IF EXISTS analytics.metrics_daily;

-- Create hourly table
CREATE TABLE IF NOT EXISTS analytics.metrics_hourly (
    project_id String,
    hour DateTime,
    metric_type LowCardinality(String),
    dimension_name LowCardinality(String),
    dimension_value String,
    event_count AggregateFunction(sum, UInt64),
    unique_users AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, hour, metric_type, dimension_name, dimension_value);

-- Recreate MVs with hourly granularity

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

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_event_name
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'event_name' AS dimension_name,
    event_name AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE event_name != ''
GROUP BY project_id, hour, event_name;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_browser
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'browser' AS dimension_name,
    browser AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE browser != ''
GROUP BY project_id, hour, browser;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_os
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'os' AS dimension_name,
    os AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE os != ''
GROUP BY project_id, hour, os;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_device_type
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'device_type' AS dimension_name,
    device_type AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE device_type != ''
GROUP BY project_id, hour, device_type;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_platform
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'platform' AS dimension_name,
    platform AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE platform != ''
GROUP BY project_id, hour, platform;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_country
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'country' AS dimension_name,
    country AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE country != ''
GROUP BY project_id, hour, country;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_metrics_path
TO analytics.metrics_hourly
AS
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'path' AS dimension_name,
    props_str['path'] AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE event_name = 'page_view' AND props_str['path'] != ''
GROUP BY project_id, hour, dimension_value;

-- Backfill from existing events

INSERT INTO analytics.metrics_hourly
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

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'event_name' AS dimension_name,
    event_name AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE event_name != ''
GROUP BY project_id, hour, event_name;

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'browser' AS dimension_name,
    browser AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE browser != ''
GROUP BY project_id, hour, browser;

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'os' AS dimension_name,
    os AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE os != ''
GROUP BY project_id, hour, os;

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'device_type' AS dimension_name,
    device_type AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE device_type != ''
GROUP BY project_id, hour, device_type;

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'platform' AS dimension_name,
    platform AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE platform != ''
GROUP BY project_id, hour, platform;

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'country' AS dimension_name,
    country AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE country != ''
GROUP BY project_id, hour, country;

INSERT INTO analytics.metrics_hourly
SELECT
    project_id,
    toStartOfHour(timestamp) AS hour,
    'event' AS metric_type,
    'path' AS dimension_name,
    props_str['path'] AS dimension_value,
    sumState(toUInt64(1)) AS event_count,
    uniqState(user_id) AS unique_users
FROM analytics.events
WHERE event_name = 'page_view' AND props_str['path'] != ''
GROUP BY project_id, hour, dimension_value;
