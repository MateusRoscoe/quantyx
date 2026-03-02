-- ================================================
-- Quantyx Analytics Queries
-- Replace {project_id} with an actual project UUID
-- ================================================

-- ── Overview ─────────────────────────────────────

-- Total events today
SELECT count() AS total_events
FROM analytics.events
WHERE date = today();

-- Events per day (last 30 days)
SELECT date, count() AS events
FROM analytics.events
WHERE date >= today() - 30
GROUP BY date
ORDER BY date;

-- Unique users per day (last 30 days)
SELECT date, uniq(user_id) AS unique_users
FROM analytics.events
WHERE date >= today() - 30
  AND user_id != ''
GROUP BY date
ORDER BY date;

-- Unique sessions per day (last 30 days)
SELECT date, uniq(session_id) AS unique_sessions
FROM analytics.events
WHERE date >= today() - 30
GROUP BY date
ORDER BY date;

-- ── Events breakdown ─────────────────────────────

-- Event counts by name (last 7 days)
SELECT event_name, count() AS total
FROM analytics.events
WHERE date >= today() - 7
GROUP BY event_name
ORDER BY total DESC;

-- Event counts by name per day (last 7 days)
SELECT date, event_name, count() AS total
FROM analytics.events
WHERE date >= today() - 7
GROUP BY date, event_name
ORDER BY date, total DESC;

-- ── Pages ────────────────────────────────────────

-- Top pages by views (last 7 days)
SELECT
    props_str['path'] AS path,
    count() AS views,
    uniq(user_id) AS unique_users,
    uniq(session_id) AS unique_sessions
FROM analytics.events
WHERE date >= today() - 7
  AND event_name = 'page_view'
  AND path != ''
GROUP BY path
ORDER BY views DESC;

-- ── Auth funnel ──────────────────────────────────


-- Sign-up funnel: clicked sign up → actually registered
-- (compare sign_up_click count with your user count in PostgreSQL)
SELECT date, event_name, count() AS total
FROM analytics.events
WHERE date >= today() - 7
  AND event_name IN ('sign_up_click', 'sign_in')
GROUP BY date, event_name
ORDER BY date, event_name;

-- ── Sessions ─────────────────────────────────────

-- Average events per session (last 7 days)
SELECT
    avg(events_in_session) AS avg_events_per_session,
    median(events_in_session) AS median_events_per_session,
    max(events_in_session) AS max_events_per_session
FROM (
    SELECT session_id, count() AS events_in_session
    FROM analytics.events
    WHERE date >= today() - 7
    GROUP BY session_id
);

-- Session duration (time between first and last event, last 7 days)
SELECT
    avg(duration) AS avg_duration_seconds,
    median(duration) AS median_duration_seconds,
    quantile(0.95)(duration) AS p95_duration_seconds
FROM (
    SELECT
        session_id,
        dateDiff('second', min(timestamp), max(timestamp)) AS duration
    FROM analytics.events
    WHERE date >= today() - 7
    GROUP BY session_id
    HAVING duration > 0
);

-- ── Devices & browsers ───────────────────────────

-- Browser breakdown (last 7 days)
SELECT browser, count() AS events, uniq(session_id) AS sessions
FROM analytics.events
WHERE date >= today() - 7
  AND browser != ''
GROUP BY browser
ORDER BY sessions DESC;

-- OS breakdown (last 7 days)
SELECT os, count() AS events, uniq(session_id) AS sessions
FROM analytics.events
WHERE date >= today() - 7
  AND os != ''
GROUP BY os
ORDER BY sessions DESC;

-- Device type breakdown (last 7 days)
SELECT device_type, count() AS events, uniq(session_id) AS sessions
FROM analytics.events
WHERE date >= today() - 7
  AND device_type != ''
GROUP BY device_type
ORDER BY sessions DESC;

-- ── Per project ──────────────────────────────────

-- Events per project (last 7 days)
SELECT project_id, count() AS events, uniq(user_id) AS unique_users
FROM analytics.events
WHERE date >= today() - 7
GROUP BY project_id
ORDER BY events DESC;

-- ── Recent activity ──────────────────────────────

-- Last 20 events
SELECT event_id, user_id, session_id, event_name, timestamp, props_str
FROM analytics.events
ORDER BY timestamp DESC
LIMIT 20;

-- ══════════════════════════════════════════════════
-- Aggregate tables (materialized views)
-- These tables use AggregateFunction columns.
-- Always query with -Merge combinators + GROUP BY.
-- ══════════════════════════════════════════════════

-- ── Users ──────────────────────────────────────

-- All users with aggregated stats
SELECT
    project_id,
    user_id,
    minMerge(first_seen) AS first_seen,
    maxMerge(last_seen) AS last_seen,
    sumMerge(total_events) AS total_events,
    anyLastMerge(props_str) AS props_str,
    anyLastMerge(props_num) AS props_num,
    anyLastMerge(props_bool) AS props_bool
FROM analytics.users
GROUP BY project_id, user_id
ORDER BY last_seen DESC;

-- Single user lookup
SELECT
    minMerge(first_seen) AS first_seen,
    maxMerge(last_seen) AS last_seen,
    sumMerge(total_events) AS total_events,
    anyLastMerge(props_str) AS props_str
FROM analytics.users
WHERE project_id = '{project_id}' AND user_id = '{user_id}'
GROUP BY project_id, user_id;

-- Top users by event count
SELECT
    user_id,
    sumMerge(total_events) AS total_events,
    minMerge(first_seen) AS first_seen,
    maxMerge(last_seen) AS last_seen
FROM analytics.users
WHERE project_id = '{project_id}'
GROUP BY project_id, user_id
ORDER BY total_events DESC
LIMIT 20;

-- ── Sessions ───────────────────────────────────

-- Recent sessions for a project
SELECT
    session_id,
    anyLastMerge(user_id) AS user_id,
    minMerge(started_at) AS started_at,
    maxMerge(ended_at) AS ended_at,
    sumMerge(total_events) AS total_events,
    sumMerge(page_views) AS page_views,
    anyMerge(browser) AS browser,
    anyMerge(os) AS os,
    anyMerge(device_type) AS device_type,
    anyMerge(country) AS country
FROM analytics.sessions
WHERE project_id = '{project_id}'
GROUP BY project_id, session_id
ORDER BY started_at DESC
LIMIT 50;

-- Single session detail
SELECT
    session_id,
    anyLastMerge(user_id) AS user_id,
    minMerge(started_at) AS started_at,
    maxMerge(ended_at) AS ended_at,
    sumMerge(total_events) AS total_events,
    sumMerge(page_views) AS page_views,
    anyMerge(browser) AS browser,
    anyMerge(os) AS os,
    anyMerge(device_type) AS device_type,
    anyMerge(country) AS country,
    anyMerge(continent) AS continent,
    anyMerge(region) AS region
FROM analytics.sessions
WHERE project_id = '{project_id}' AND session_id = '{session_id}'
GROUP BY project_id, session_id;

-- Sessions for a specific user
SELECT
    session_id,
    minMerge(started_at) AS started_at,
    maxMerge(ended_at) AS ended_at,
    sumMerge(total_events) AS total_events,
    sumMerge(page_views) AS page_views,
    anyMerge(browser) AS browser,
    anyMerge(os) AS os,
    anyMerge(device_type) AS device_type,
    anyMerge(country) AS country
FROM analytics.sessions
WHERE project_id = '{project_id}'
GROUP BY project_id, session_id
HAVING anyLastMerge(user_id) = '{user_id}'
ORDER BY started_at DESC;

-- ── Metrics daily ──────────────────────────────

-- Overall events per day (last 30 days)
SELECT
    `date`,
    sumMerge(event_count) AS event_count,
    uniqMerge(unique_users) AS unique_users
FROM analytics.metrics_daily
WHERE project_id = '{project_id}'
  AND dimension_name = 'overall'
  AND `date` >= today() - 30
GROUP BY `date`
ORDER BY `date`;

-- Event name breakdown per day
SELECT
    `date`,
    dimension_value AS event_name,
    sumMerge(event_count) AS event_count,
    uniqMerge(unique_users) AS unique_users
FROM analytics.metrics_daily
WHERE project_id = '{project_id}'
  AND dimension_name = 'event_name'
  AND `date` >= today() - 7
GROUP BY `date`, dimension_value
ORDER BY `date`, event_count DESC;

-- Browser breakdown (last 7 days)
SELECT
    dimension_value AS browser,
    sumMerge(event_count) AS event_count,
    uniqMerge(unique_users) AS unique_users
FROM analytics.metrics_daily
WHERE project_id = '{project_id}'
  AND dimension_name = 'browser'
  AND `date` >= today() - 7
GROUP BY dimension_value
ORDER BY event_count DESC;

-- Top pages (last 7 days)
SELECT
    dimension_value AS path,
    sumMerge(event_count) AS views,
    uniqMerge(unique_users) AS unique_users
FROM analytics.metrics_daily
WHERE project_id = '{project_id}'
  AND dimension_name = 'path'
  AND `date` >= today() - 7
GROUP BY dimension_value
ORDER BY views DESC;

-- ── Property metadata ──────────────────────────

-- All tracked properties for a project
SELECT
    property_name,
    property_type,
    minMerge(first_seen) AS first_seen,
    maxMerge(last_seen) AS last_seen,
    sumMerge(event_count) AS event_count,
    anyMerge(example_value) AS example_value
FROM analytics.property_metadata
WHERE project_id = '{project_id}'
GROUP BY property_name, property_type
ORDER BY event_count DESC;
