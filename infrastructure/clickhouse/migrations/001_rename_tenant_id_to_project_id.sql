-- Migration: Rename tenant_id to project_id across all analytics tables
-- For dev: drop ClickHouse volume and let init SQL recreate tables
-- For production: run these ALTER statements

ALTER TABLE analytics.events RENAME COLUMN tenant_id TO project_id;
ALTER TABLE analytics.users RENAME COLUMN tenant_id TO project_id;
ALTER TABLE analytics.metrics_daily RENAME COLUMN tenant_id TO project_id;
ALTER TABLE analytics.property_metadata RENAME COLUMN tenant_id TO project_id;
