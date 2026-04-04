import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  queryClickHouse,
  buildEventFilters,
  parsePropertyFilters,
  buildPropertyFilterClauses,
} from '../../helpers/query';

const dateRangeSchema = z.object({
  from: z.string(), // ISO datetime or YYYY-MM-DD
  to: z.string(),
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

      const [kpis, sessions, pageViews, timeseries] = await Promise.all([
        queryClickHouse<{ total_events: string; unique_users: string }>(
          `SELECT
            sumMerge(event_count) as total_events,
            uniqMerge(unique_users) as unique_users
          FROM analytics.metrics_hourly
          WHERE project_id = {projectId:String}
            AND hour >= toDateTime({from:String})
            AND hour < toDateTime({to:String})
            AND dimension_name = 'overall'`,
          { projectId, from, to },
        ),
        queryClickHouse<{ total_sessions: string }>(
          `SELECT count(DISTINCT session_id) as total_sessions
          FROM analytics.events
          WHERE project_id = {projectId:String}
            AND timestamp >= toDateTime({from:String})
            AND timestamp < toDateTime({to:String})
            AND session_id != ''`,
          { projectId, from, to },
        ),
        queryClickHouse<{ page_views: string }>(
          `SELECT sumMerge(event_count) as page_views
          FROM analytics.metrics_hourly
          WHERE project_id = {projectId:String}
            AND hour >= toDateTime({from:String})
            AND hour < toDateTime({to:String})
            AND dimension_name = 'event_name'
            AND dimension_value = 'page_view'`,
          { projectId, from, to },
        ),
        queryClickHouse<{ hour: string; events: string; users: string }>(
          `SELECT
            hour,
            sumMerge(event_count) as events,
            uniqMerge(unique_users) as users
          FROM analytics.metrics_hourly
          WHERE project_id = {projectId:String}
            AND hour >= toDateTime({from:String})
            AND hour < toDateTime({to:String})
            AND dimension_name = 'overall'
          GROUP BY hour
          ORDER BY hour`,
          { projectId, from, to },
        ),
      ]);

      return {
        kpis: {
          totalEvents: Number(kpis[0]?.total_events ?? 0),
          uniqueUsers: Number(kpis[0]?.unique_users ?? 0),
          totalSessions: Number(sessions[0]?.total_sessions ?? 0),
          pageViews: Number(pageViews[0]?.page_views ?? 0),
        },
        timeseries: timeseries.map((row) => ({
          hour: row.hour,
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
        FROM analytics.metrics_hourly
        WHERE project_id = {projectId:String}
          AND hour >= toDateTime({from:String})
          AND hour < toDateTime({to:String})
          AND dimension_name = 'event_name'
        GROUP BY dimension_value
        ORDER BY event_count DESC`,
        { projectId, from, to },
      );

      const timeseries = await queryClickHouse<{
        hour: string;
        event_name: string;
        count: string;
      }>(
        `SELECT
          hour,
          dimension_value as event_name,
          sumMerge(event_count) as count
        FROM analytics.metrics_hourly
        WHERE project_id = {projectId:String}
          AND hour >= toDateTime({from:String})
          AND hour < toDateTime({to:String})
          AND dimension_name = 'event_name'
        GROUP BY hour, dimension_value
        ORDER BY hour`,
        { projectId, from, to },
      );

      return {
        breakdown: events.map((e) => ({
          eventName: e.event_name,
          count: Number(e.event_count),
          uniqueUsers: Number(e.unique_users),
        })),
        timeseries: timeseries.map((row) => ({
          hour: row.hour,
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
        FROM analytics.metrics_hourly
        WHERE project_id = {projectId:String}
          AND hour >= toDateTime({from:String})
          AND hour < toDateTime({to:String})
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
          FROM analytics.metrics_hourly
          WHERE project_id = {projectId:String}
            AND hour >= toDateTime({from:String})
            AND hour < toDateTime({to:String})
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
        FROM analytics.metrics_hourly
        WHERE project_id = {projectId:String}
          AND hour >= toDateTime({from:String})
          AND hour < toDateTime({to:String})
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
        limit: z.coerce.number().min(1).max(200).default(50),
        direction: z.enum(['asc', 'desc']).default('desc'),
        cursor_ts: z.string().optional(),
        cursor_id: z.string().optional(),
      }),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, limit, direction, cursor_ts, cursor_id } =
        request.query as {
          from: string;
          to: string;
          limit: number;
          direction: 'asc' | 'desc';
          cursor_ts?: string;
          cursor_id?: string;
        };

      await fastify.verifyProjectAccess(request, projectId);

      const hasCursor = cursor_ts && cursor_id;
      const op = direction === 'desc' ? '<' : '>';
      const cursorClause = hasCursor
        ? `AND (started_at, session_id) ${op} (toDateTime({cursorTs:String}), {cursorId:String})`
        : '';

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
          anyLastMerge(user_id) as user_id,
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
          AND started_at < toDateTime({to:String})
          ${cursorClause}
        ORDER BY started_at ${direction === 'desc' ? 'DESC' : 'ASC'}, session_id ${direction === 'desc' ? 'DESC' : 'ASC'}
        LIMIT {fetchLimit:UInt32}`,
        {
          projectId,
          from,
          to,
          ...(hasCursor && { cursorTs: cursor_ts, cursorId: cursor_id }),
          fetchLimit: limit + 1,
        },
      );

      const hasMore = sessions.length > limit;
      const page = hasMore ? sessions.slice(0, limit) : sessions;

      return {
        sessions: page.map((s) => ({
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
        hasMore,
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
      querystring: z.object({
        limit: z.coerce.number().min(1).max(200).default(50),
        direction: z.enum(['asc', 'desc']).default('asc'),
        cursor_ts: z.string().optional(),
        cursor_id: z.string().optional(),
      }),
    },
    handler: async (request, reply) => {
      const { projectId, sessionId } = request.params as {
        projectId: string;
        sessionId: string;
      };
      const { limit, direction, cursor_ts, cursor_id } = request.query as {
        limit: number;
        direction: 'asc' | 'desc';
        cursor_ts?: string;
        cursor_id?: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      // Fetch session metadata from the aggregate table
      const sessionRows = await queryClickHouse<{
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
          anyLastMerge(user_id) as user_id,
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
          AND session_id = {sessionId:String}
        GROUP BY session_id`,
        { projectId, sessionId },
      );

      const s = sessionRows[0];
      const session = s
        ? {
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
          }
        : null;

      // Build cursor-based event query
      const hasCursor = cursor_ts && cursor_id;
      const op = direction === 'asc' ? '>' : '<';
      const cursorClause = hasCursor
        ? `AND (timestamp, event_id) ${op} ({cursorTs:String}, {cursorId:String})`
        : '';

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
          ${cursorClause}
        ORDER BY timestamp ${direction === 'asc' ? 'ASC' : 'DESC'}, event_id ${direction === 'asc' ? 'ASC' : 'DESC'}
        LIMIT {fetchLimit:UInt32}`,
        {
          projectId,
          sessionId,
          ...(hasCursor && { cursorTs: cursor_ts, cursorId: cursor_id }),
          fetchLimit: limit + 1,
        },
      );

      const hasMore = events.length > limit;
      const page = hasMore ? events.slice(0, limit) : events;

      return { session, events: page, hasMore };
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

  // ─── Event Feed (raw events explorer) ───

  fastify.get('/projects/:projectId/events/feed', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: querySchema.extend({
        user_id: z.string().optional(),
        session_id: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).default(50),
        direction: z.enum(['asc', 'desc']).default('desc'),
        cursor_ts: z.string().optional(),
        cursor_id: z.string().optional(),
      }).passthrough(), // Allow prop_str.*, prop_num.*, prop_bool.* params
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, limit, direction, cursor_ts, cursor_id, ...rest } =
        request.query as Record<string, string> & {
          from: string;
          to: string;
          limit: number;
          direction: 'asc' | 'desc';
          cursor_ts?: string;
          cursor_id?: string;
        };

      await fastify.verifyProjectAccess(request, projectId);

      // Build dimension filters
      const dimFilters = buildEventFilters({
        browser: rest.browser,
        os: rest.os,
        country: rest.country,
        device_type: rest.device_type,
        event_name: rest.event_name,
        path: rest.path,
        user_id: rest.user_id,
        session_id: rest.session_id,
      });

      // Build property filters
      const propFilters = parsePropertyFilters(rest);
      const propClauses = buildPropertyFilterClauses(propFilters);

      // Build cursor clause
      const hasCursor = cursor_ts && cursor_id;
      const op = direction === 'desc' ? '<' : '>';
      const cursorClause = hasCursor
        ? `AND (timestamp, event_id) ${op} ({cursorTs:String}, {cursorId:String})`
        : '';

      const allClauses = [...dimFilters.clauses, ...propClauses.clauses];
      const filterWhere =
        allClauses.length > 0 ? `AND ${allClauses.join(' AND ')}` : '';

      const events = await queryClickHouse<{
        event_id: string;
        event_name: string;
        timestamp: string;
        user_id: string;
        session_id: string;
        browser: string;
        os: string;
        device_type: string;
        country: string;
        props_str: Record<string, string>;
        props_num: Record<string, number>;
        props_bool: Record<string, number>;
      }>(
        `SELECT
          event_id, event_name, timestamp, user_id, session_id,
          browser, os, device_type, country,
          props_str, props_num, props_bool
        FROM analytics.events
        WHERE project_id = {projectId:String}
          AND timestamp >= toDateTime({from:String})
          AND timestamp < toDateTime({to:String})
          ${cursorClause}
          ${filterWhere}
        ORDER BY timestamp ${direction === 'desc' ? 'DESC' : 'ASC'}, event_id ${direction === 'desc' ? 'DESC' : 'ASC'}
        LIMIT {fetchLimit:UInt32}`,
        {
          projectId,
          from,
          to,
          ...(hasCursor && { cursorTs: cursor_ts, cursorId: cursor_id }),
          ...dimFilters.params,
          ...propClauses.params,
          fetchLimit: limit + 1,
        },
      );

      const hasMore = events.length > limit;
      const page = hasMore ? events.slice(0, limit) : events;

      return { events: page, hasMore };
    },
  });

  // ─── Property Values ───

  fastify.get('/projects/:projectId/properties/:propertyName/values', {
    schema: {
      params: z.object({
        projectId: z.string().uuid(),
        propertyName: z.string(),
      }),
      querystring: z.object({
        type: z.enum(['str', 'num', 'bool']),
        search: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).default(50),
      }),
    },
    handler: async (request, reply) => {
      const { projectId, propertyName } = request.params as {
        projectId: string;
        propertyName: string;
      };
      const { type, search, limit } = request.query as {
        type: 'str' | 'num' | 'bool';
        search?: string;
        limit: number;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const colMap = { str: 'props_str', num: 'props_num', bool: 'props_bool' } as const;
      const col = colMap[type];

      const searchClause = search
        ? `AND ${col}[{name:String}] LIKE {search:String}`
        : '';

      const rows = await queryClickHouse<{ value: string }>(
        `SELECT DISTINCT toString(${col}[{name:String}]) as value
        FROM analytics.events
        WHERE project_id = {projectId:String}
          AND mapContains(${col}, {name:String})
          ${searchClause}
        ORDER BY value
        LIMIT {limit:UInt32}`,
        {
          projectId,
          name: propertyName,
          ...(search && { search: `${search}%` }),
          limit,
        },
      );

      return { values: rows.map((r) => r.value) };
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
        hour: string;
        value: string;
      }>(
        `SELECT
          hour,
          ${metricExpr} as value
        FROM analytics.metrics_hourly
        WHERE project_id = {projectId:String}
          AND hour >= toDateTime({from:String})
          AND hour < toDateTime({to:String})
          AND dimension_name = 'overall'
        GROUP BY hour
        ORDER BY hour`,
        { projectId, from, to },
      );

      return {
        timeseries: rows.map((r) => ({
          hour: r.hour,
          value: Number(r.value),
        })),
      };
    },
  });
}
