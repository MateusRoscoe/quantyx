import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryClickHouse } from '../../helpers/query';

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const filterSchema = z.object({
  browser: z.string().optional(),
  os: z.string().optional(),
  country: z.string().optional(),
  device_type: z.string().optional(),
  event_name: z.string().optional(),
  path: z.string().optional(),
});

const querySchema = dateRangeSchema.merge(filterSchema);

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // ─── Overview KPIs ───

  fastify.get('/projects/:projectId/overview', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to } = request.query as { from: string; to: string };

      await fastify.verifyProjectAccess(request, projectId);

      // Current period KPIs
      const kpis = await queryClickHouse<{
        total_events: string;
        unique_users: string;
      }>(
        `SELECT
          sumMerge(event_count) as total_events,
          uniqMerge(unique_users) as unique_users
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'overall'`,
        { projectId, from, to },
      );

      // Sessions count
      const sessions = await queryClickHouse<{ total_sessions: string }>(
        `SELECT count() as total_sessions
        FROM (
          SELECT session_id
          FROM analytics.sessions
          WHERE project_id = {projectId:String}
          GROUP BY session_id
          HAVING minMerge(started_at) >= toDateTime({from:String})
            AND minMerge(started_at) <= toDateTime({to:String} || ' 23:59:59')
        )`,
        { projectId, from, to },
      );

      // Page views
      const pageViews = await queryClickHouse<{ page_views: string }>(
        `SELECT sumMerge(event_count) as page_views
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'event_name'
          AND dimension_value = 'page_view'`,
        { projectId, from, to },
      );

      // Daily time series for sparklines
      const timeseries = await queryClickHouse<{
        date: string;
        events: string;
        users: string;
      }>(
        `SELECT
          date,
          sumMerge(event_count) as events,
          uniqMerge(unique_users) as users
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'overall'
        GROUP BY date
        ORDER BY date`,
        { projectId, from, to },
      );

      return {
        kpis: {
          totalEvents: Number(kpis[0]?.total_events ?? 0),
          uniqueUsers: Number(kpis[0]?.unique_users ?? 0),
          totalSessions: Number(sessions[0]?.total_sessions ?? 0),
          pageViews: Number(pageViews[0]?.page_views ?? 0),
        },
        timeseries: timeseries.map((row) => ({
          date: row.date,
          events: Number(row.events),
          users: Number(row.users),
        })),
      };
    },
  });

  // ─── Events Breakdown ───

  fastify.get('/projects/:projectId/events', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to } = request.query as { from: string; to: string };

      await fastify.verifyProjectAccess(request, projectId);

      const events = await queryClickHouse<{
        event_name: string;
        event_count: string;
        unique_users: string;
      }>(
        `SELECT
          dimension_value as event_name,
          sumMerge(event_count) as event_count,
          uniqMerge(unique_users) as unique_users
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'event_name'
        GROUP BY dimension_value
        ORDER BY event_count DESC`,
        { projectId, from, to },
      );

      const timeseries = await queryClickHouse<{
        date: string;
        event_name: string;
        count: string;
      }>(
        `SELECT
          date,
          dimension_value as event_name,
          sumMerge(event_count) as count
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'event_name'
        GROUP BY date, dimension_value
        ORDER BY date`,
        { projectId, from, to },
      );

      return {
        breakdown: events.map((e) => ({
          eventName: e.event_name,
          count: Number(e.event_count),
          uniqueUsers: Number(e.unique_users),
        })),
        timeseries: timeseries.map((row) => ({
          date: row.date,
          eventName: row.event_name,
          count: Number(row.count),
        })),
      };
    },
  });

  // ─── Pages Breakdown ───

  fastify.get('/projects/:projectId/pages', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to } = request.query as { from: string; to: string };

      await fastify.verifyProjectAccess(request, projectId);

      const pages = await queryClickHouse<{
        path: string;
        views: string;
        unique_users: string;
      }>(
        `SELECT
          dimension_value as path,
          sumMerge(event_count) as views,
          uniqMerge(unique_users) as unique_users
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'path'
        GROUP BY dimension_value
        ORDER BY views DESC`,
        { projectId, from, to },
      );

      return {
        pages: pages.map((p) => ({
          path: p.path,
          views: Number(p.views),
          uniqueUsers: Number(p.unique_users),
        })),
      };
    },
  });

  // ─── Devices / Browser / OS Breakdown ───

  fastify.get('/projects/:projectId/devices', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to } = request.query as { from: string; to: string };

      await fastify.verifyProjectAccess(request, projectId);

      async function getDimension(dimensionName: string) {
        return queryClickHouse<{
          value: string;
          count: string;
          unique_users: string;
        }>(
          `SELECT
            dimension_value as value,
            sumMerge(event_count) as count,
            uniqMerge(unique_users) as unique_users
          FROM analytics.metrics_daily
          WHERE project_id = {projectId:String}
            AND date >= {from:String}
            AND date <= {to:String}
            AND dimension_name = {dim:String}
          GROUP BY dimension_value
          ORDER BY count DESC`,
          { projectId, from, to, dim: dimensionName },
        );
      }

      const [deviceTypes, browsers, operatingSystems] = await Promise.all([
        getDimension('device_type'),
        getDimension('browser'),
        getDimension('os'),
      ]);

      const mapRows = (rows: { value: string; count: string; unique_users: string }[]) =>
        rows.map((r) => ({
          value: r.value,
          count: Number(r.count),
          uniqueUsers: Number(r.unique_users),
        }));

      return {
        deviceTypes: mapRows(deviceTypes),
        browsers: mapRows(browsers),
        operatingSystems: mapRows(operatingSystems),
      };
    },
  });

  // ─── Geography ───

  fastify.get('/projects/:projectId/geography', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to } = request.query as { from: string; to: string };

      await fastify.verifyProjectAccess(request, projectId);

      const countries = await queryClickHouse<{
        country: string;
        count: string;
        unique_users: string;
      }>(
        `SELECT
          dimension_value as country,
          sumMerge(event_count) as count,
          uniqMerge(unique_users) as unique_users
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'country'
        GROUP BY dimension_value
        ORDER BY count DESC`,
        { projectId, from, to },
      );

      return {
        countries: countries.map((c) => ({
          country: c.country,
          count: Number(c.count),
          uniqueUsers: Number(c.unique_users),
        })),
      };
    },
  });

  // ─── Sessions ───

  fastify.get('/projects/:projectId/sessions', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema.extend({
        limit: z.coerce.number().default(50),
        offset: z.coerce.number().default(0),
      }),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, limit, offset } = request.query as {
        from: string;
        to: string;
        limit: number;
        offset: number;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const sessions = await queryClickHouse<{
        session_id: string;
        user_id: string;
        started_at: string;
        ended_at: string;
        total_events: string;
        page_views: string;
        browser: string;
        os: string;
        device_type: string;
        country: string;
      }>(
        `SELECT
          session_id,
          anyMerge(user_id) as user_id,
          minMerge(started_at) as started_at,
          maxMerge(ended_at) as ended_at,
          sumMerge(total_events) as total_events,
          sumMerge(page_views) as page_views,
          anyMerge(browser) as browser,
          anyMerge(os) as os,
          anyMerge(device_type) as device_type,
          anyMerge(country) as country
        FROM analytics.sessions
        WHERE project_id = {projectId:String}
        GROUP BY session_id
        HAVING started_at >= toDateTime({from:String})
          AND started_at <= toDateTime({to:String} || ' 23:59:59')
        ORDER BY started_at DESC
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
        { projectId, from, to, limit, offset },
      );

      return {
        sessions: sessions.map((s) => ({
          sessionId: s.session_id,
          userId: s.user_id,
          startedAt: s.started_at,
          endedAt: s.ended_at,
          totalEvents: Number(s.total_events),
          pageViews: Number(s.page_views),
          browser: s.browser,
          os: s.os,
          deviceType: s.device_type,
          country: s.country,
        })),
      };
    },
  });

  // ─── Session Detail ───

  fastify.get('/projects/:projectId/sessions/:sessionId', {
    schema: {
      params: z.object({
        projectId: z.string().uuid(),
        sessionId: z.string(),
      }),
    },
    handler: async (request, reply) => {
      const { projectId, sessionId } = request.params as {
        projectId: string;
        sessionId: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const events = await queryClickHouse<{
        event_id: string;
        event_name: string;
        timestamp: string;
        user_id: string;
        props_str: string;
      }>(
        `SELECT
          event_id,
          event_name,
          timestamp,
          user_id,
          props_str
        FROM analytics.events
        WHERE project_id = {projectId:String}
          AND session_id = {sessionId:String}
        ORDER BY timestamp ASC`,
        { projectId, sessionId },
      );

      return { events };
    },
  });

  // ─── Users ───

  fastify.get('/projects/:projectId/users', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema.extend({
        limit: z.coerce.number().default(50),
        offset: z.coerce.number().default(0),
      }),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { limit, offset } = request.query as {
        from: string;
        to: string;
        limit: number;
        offset: number;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const users = await queryClickHouse<{
        user_id: string;
        first_seen: string;
        last_seen: string;
        total_events: string;
      }>(
        `SELECT
          user_id,
          minMerge(first_seen) as first_seen,
          maxMerge(last_seen) as last_seen,
          sumMerge(total_events) as total_events
        FROM analytics.users
        WHERE project_id = {projectId:String}
          AND user_id != ''
        GROUP BY user_id
        ORDER BY total_events DESC
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
        { projectId, limit, offset },
      );

      return {
        users: users.map((u) => ({
          userId: u.user_id,
          firstSeen: u.first_seen,
          lastSeen: u.last_seen,
          totalEvents: Number(u.total_events),
        })),
      };
    },
  });

  // ─── Properties Metadata ───

  fastify.get('/projects/:projectId/properties', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };

      await fastify.verifyProjectAccess(request, projectId);

      const properties = await queryClickHouse<{
        property_name: string;
        property_type: string;
        first_seen: string;
        last_seen: string;
        event_count: string;
        unique_values: string;
        example_value: string;
      }>(
        `SELECT
          property_name,
          property_type,
          minMerge(first_seen) as first_seen,
          maxMerge(last_seen) as last_seen,
          sumMerge(event_count) as event_count,
          uniqMerge(unique_values) as unique_values,
          anyMerge(example_value) as example_value
        FROM analytics.property_metadata
        WHERE project_id = {projectId:String}
        GROUP BY property_name, property_type
        ORDER BY event_count DESC`,
        { projectId },
      );

      return {
        properties: properties.map((p) => ({
          name: p.property_name,
          type: p.property_type,
          firstSeen: p.first_seen,
          lastSeen: p.last_seen,
          eventCount: Number(p.event_count),
          uniqueValues: Number(p.unique_values),
          exampleValue: p.example_value,
        })),
      };
    },
  });

  // ─── Timeseries (flexible) ───

  fastify.get('/projects/:projectId/timeseries', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema.extend({
        metric: z.enum(['events', 'users']).default('events'),
      }),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, metric } = request.query as {
        from: string;
        to: string;
        metric: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const metricExpr =
        metric === 'users'
          ? 'uniqMerge(unique_users)'
          : 'sumMerge(event_count)';

      const rows = await queryClickHouse<{
        date: string;
        value: string;
      }>(
        `SELECT
          date,
          ${metricExpr} as value
        FROM analytics.metrics_daily
        WHERE project_id = {projectId:String}
          AND date >= {from:String}
          AND date <= {to:String}
          AND dimension_name = 'overall'
        GROUP BY date
        ORDER BY date`,
        { projectId, from, to },
      );

      return {
        timeseries: rows.map((r) => ({
          date: r.date,
          value: Number(r.value),
        })),
      };
    },
  });
}
