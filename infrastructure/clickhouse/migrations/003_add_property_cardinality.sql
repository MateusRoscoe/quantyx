-- Migration: Add unique_values (cardinality) column to property_metadata
-- For dev: drop and recreate (data repopulates from MVs on next insert)
-- For prod: ALTER TABLE + backfill

-- ══════════════════════════
-- DEV: Drop volume approach
-- ══════════════════════════

-- Drop the 3 property metadata MVs
DROP VIEW IF EXISTS analytics.mv_property_metadata_str;
DROP VIEW IF EXISTS analytics.mv_property_metadata_num;
DROP VIEW IF EXISTS analytics.mv_property_metadata_bool;

-- Drop and recreate the table with the new column
DROP TABLE IF EXISTS analytics.property_metadata;

CREATE TABLE IF NOT EXISTS analytics.property_metadata (
    project_id String,
    property_name String,
    property_type LowCardinality(String),
    first_seen AggregateFunction(min, DateTime),
    last_seen AggregateFunction(max, DateTime),
    event_count AggregateFunction(sum, UInt64),
    unique_values AggregateFunction(uniq, String),
    example_value AggregateFunction(any, String),
    updated_at AggregateFunction(max, DateTime)
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, property_name, property_type);

-- Recreate MVs with unique_values

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_property_metadata_str
TO analytics.property_metadata
AS
SELECT
    project_id,
    key AS property_name,
    'string' AS property_type,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS event_count,
    uniqState(toString(props_str[key])) AS unique_values,
    anyState(toString(props_str[key])) AS example_value,
    maxState(timestamp) AS updated_at
FROM analytics.events
ARRAY JOIN mapKeys(props_str) AS key
GROUP BY project_id, key;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_property_metadata_num
TO analytics.property_metadata
AS
SELECT
    project_id,
    key AS property_name,
    'number' AS property_type,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS event_count,
    uniqState(toString(props_num[key])) AS unique_values,
    anyState(toString(props_num[key])) AS example_value,
    maxState(timestamp) AS updated_at
FROM analytics.events
ARRAY JOIN mapKeys(props_num) AS key
GROUP BY project_id, key;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_property_metadata_bool
TO analytics.property_metadata
AS
SELECT
    project_id,
    key AS property_name,
    'boolean' AS property_type,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS event_count,
    uniqState(if(props_bool[key] = 1, 'true', 'false')) AS unique_values,
    anyState(if(props_bool[key] = 1, 'true', 'false')) AS example_value,
    maxState(timestamp) AS updated_at
FROM analytics.events
ARRAY JOIN mapKeys(props_bool) AS key
GROUP BY project_id, key;

-- Backfill from existing events (runs entirely inside ClickHouse, no data leaves the server)

INSERT INTO analytics.property_metadata
SELECT
    project_id,
    key AS property_name,
    'string' AS property_type,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS event_count,
    uniqState(toString(props_str[key])) AS unique_values,
    anyState(toString(props_str[key])) AS example_value,
    maxState(timestamp) AS updated_at
FROM analytics.events
ARRAY JOIN mapKeys(props_str) AS key
GROUP BY project_id, key;

INSERT INTO analytics.property_metadata
SELECT
    project_id,
    key AS property_name,
    'number' AS property_type,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS event_count,
    uniqState(toString(props_num[key])) AS unique_values,
    anyState(toString(props_num[key])) AS example_value,
    maxState(timestamp) AS updated_at
FROM analytics.events
ARRAY JOIN mapKeys(props_num) AS key
GROUP BY project_id, key;

INSERT INTO analytics.property_metadata
SELECT
    project_id,
    key AS property_name,
    'boolean' AS property_type,
    minState(timestamp) AS first_seen,
    maxState(timestamp) AS last_seen,
    sumState(toUInt64(1)) AS event_count,
    uniqState(if(props_bool[key] = 1, 'true', 'false')) AS unique_values,
    anyState(if(props_bool[key] = 1, 'true', 'false')) AS example_value,
    maxState(timestamp) AS updated_at
FROM analytics.events
ARRAY JOIN mapKeys(props_bool) AS key
GROUP BY project_id, key;
