import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  queryClickHouse,
  buildEventFilters,
  parsePropertyFilters,
  buildPropertyFilterClauses,
} from '../../helpers/query';
import { mergeProps } from '../../helpers/merge-props';

const MAX_DATE_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

function withDateRangeLimit<T extends z.ZodType<{ from: string; to: string }>>(
  schema: T,
) {
  return schema.refine(
    (val) => {
      const from = new Date(val.from);
      const to = new Date(val.to);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
      if (to <= from) return false;
      return to.getTime() - from.getTime() <= MAX_DATE_RANGE_MS;
    },
    {
      message:
        'Date range must not exceed 90 days and "to" must be after "from"',
    },
  );
}

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
      querystring: withDateRangeLimit(querySchema),
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
          `SELECT count() as total_sessions
          FROM (
            SELECT session_id
            FROM analytics.sessions_daily
            WHERE project_id = {projectId:String}
              AND started_at >= toDateTime({from:String})
              AND started_at < toDateTime({to:String})
            GROUP BY session_id
          )`,
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
      querystring: withDateRangeLimit(querySchema),
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
      querystring: withDateRangeLimit(querySchema),
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
      querystring: withDateRangeLimit(querySchema),
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

      const mapRows = (
        rows: { value: string; count: string; unique_users: string }[],
      ) =>
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
      querystring: withDateRangeLimit(querySchema),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to } = request.query as { from: string; to: string };

      await fastify.verifyProjectAccess(request, projectId);

      async function getDimension(dimensionName: string, limit?: number) {
        const limitClause = limit ? `LIMIT {limit:UInt32}` : '';
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
          ORDER BY count DESC
          ${limitClause}`,
          { projectId, from, to, dim: dimensionName, ...(limit && { limit }) },
        );
      }

      const [continents, countries, regions, cities, cityCoords] =
        await Promise.all([
          getDimension('continent'),
          getDimension('country'),
          getDimension('region'),
          getDimension('city', 100),
          queryClickHouse<{
            city: string;
            country: string;
            latitude: string;
            longitude: string;
            event_count: string;
          }>(
            `SELECT
              city,
              country,
              anyMerge(latitude) as latitude,
              anyMerge(longitude) as longitude,
              sumMerge(event_count) as event_count
            FROM analytics.city_coordinates
            WHERE project_id = {projectId:String}
            GROUP BY city, country
            ORDER BY event_count DESC
            LIMIT 100`,
            { projectId },
          ),
        ]);

      const mapRows = (
        rows: { value: string; count: string; unique_users: string }[],
      ) =>
        rows.map((r) => ({
          value: r.value,
          count: Number(r.count),
          uniqueUsers: Number(r.unique_users),
        }));

      // Build a city-name-keyed lookup for O(n+m) instead of O(n*m)
      const coordsByCityName = new Map<
        string,
        { latitude: number; longitude: number }
      >();
      for (const c of cityCoords) {
        if (!coordsByCityName.has(c.city)) {
          coordsByCityName.set(c.city, {
            latitude: Number(c.latitude),
            longitude: Number(c.longitude),
          });
        }
      }

      return {
        continents: mapRows(continents),
        countries: countries.map((c) => ({
          country: c.value,
          count: Number(c.count),
          uniqueUsers: Number(c.unique_users),
        })),
        regions: mapRows(regions),
        cities: cities.map((c) => {
          const coords = coordsByCityName.get(c.value) ?? {
            latitude: 0,
            longitude: 0,
          };
          return {
            value: c.value,
            count: Number(c.count),
            uniqueUsers: Number(c.unique_users),
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }),
      };
    },
  });

  // ─── Geography Drill-Down ───

  fastify.get('/projects/:projectId/geography/drill-down', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: withDateRangeLimit(
        dateRangeSchema.extend({
          dimension: z.enum(['country', 'city', 'state']),
          continent: z.string().optional(),
          country: z.string().optional(),
          limit: z.coerce.number().min(1).max(200).default(50),
        }),
      ),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, dimension, continent, country, limit } =
        request.query as {
          from: string;
          to: string;
          dimension: 'country' | 'city' | 'state';
          continent?: string;
          country?: string;
          limit: number;
        };

      await fastify.verifyProjectAccess(request, projectId);

      const filters: string[] = [];
      const params: Record<string, string | number> = {
        projectId,
        from,
        to,
        limit,
      };

      if (continent) {
        filters.push('AND continent = {continent:String}');
        params.continent = continent;
      }
      if (country) {
        filters.push('AND country = {country:String}');
        params.country = country;
      }

      const filterClause = filters.join(' ');

      // For city drill-down, enrich with lat/lon from city_coordinates
      if (dimension === 'city') {
        const rows = await queryClickHouse<{
          value: string;
          count: string;
          unique_users: string;
          latitude: string;
          longitude: string;
        }>(
          `SELECT
            g.value,
            g.count,
            g.unique_users,
            c.latitude,
            c.longitude
          FROM (
            SELECT
              city as value,
              sumMerge(event_count) as count,
              uniqMerge(unique_users) as unique_users,
              any(country) as country
            FROM analytics.metrics_geo
            WHERE project_id = {projectId:String}
              AND hour >= toDateTime({from:String})
              AND hour < toDateTime({to:String})
              AND city != ''
              ${filterClause}
            GROUP BY city
            ORDER BY count DESC
            LIMIT {limit:UInt32}
          ) AS g
          LEFT JOIN (
            SELECT city, country,
              anyMerge(latitude) as latitude,
              anyMerge(longitude) as longitude
            FROM analytics.city_coordinates
            WHERE project_id = {projectId:String}
            GROUP BY city, country
          ) AS c ON g.value = c.city AND g.country = c.country
          ORDER BY g.count DESC`,
          params,
        );

        return {
          data: rows.map((r) => ({
            value: r.value,
            count: Number(r.count),
            uniqueUsers: Number(r.unique_users),
            latitude: Number(r.latitude ?? 0),
            longitude: Number(r.longitude ?? 0),
          })),
        };
      }

      const rows = await queryClickHouse<{
        value: string;
        count: string;
        unique_users: string;
      }>(
        `SELECT
          ${dimension} as value,
          sumMerge(event_count) as count,
          uniqMerge(unique_users) as unique_users
        FROM analytics.metrics_geo
        WHERE project_id = {projectId:String}
          AND hour >= toDateTime({from:String})
          AND hour < toDateTime({to:String})
          AND ${dimension} != ''
          ${filterClause}
        GROUP BY ${dimension}
        ORDER BY count DESC
        LIMIT {limit:UInt32}`,
        params,
      );

      return {
        data: rows.map((r) => ({
          value: r.value,
          count: Number(r.count),
          uniqueUsers: Number(r.unique_users),
        })),
      };
    },
  });

  // ─── Sessions ───

  fastify.get('/projects/:projectId/sessions', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: withDateRangeLimit(
        querySchema.extend({
          limit: z.coerce.number().min(1).max(200).default(50),
          direction: z.enum(['asc', 'desc']).default('desc'),
          cursor_ts: z.string().optional(),
          cursor_id: z.string().optional(),
          user_id: z.string().optional(),
        }),
      ),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, limit, direction, cursor_ts, cursor_id, user_id } =
        request.query as {
          from: string;
          to: string;
          limit: number;
          direction: 'asc' | 'desc';
          cursor_ts?: string;
          cursor_id?: string;
          user_id?: string;
        };

      await fastify.verifyProjectAccess(request, projectId);

      const hasCursor = cursor_ts && cursor_id;
      const op = direction === 'desc' ? '<' : '>';
      const cursorClause = hasCursor
        ? `HAVING (min(started_at), session_id) ${op} (toDateTime({cursorTs:String}), {cursorId:String})`
        : '';
      const userFilter = user_id ? `AND sd.user_id = {userId:String}` : '';

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
          sd.session_id,
          max(sd.user_id) as user_id,
          min(sd.started_at) as started_at,
          max(sd.ended_at) as ended_at,
          sum(sd.total_events) as total_events,
          sum(sd.page_views) as page_views,
          any(sd.browser) as browser,
          any(sd.os) as os,
          any(sd.device_type) as device_type,
          any(sd.country) as country
        FROM analytics.sessions_daily AS sd
        WHERE sd.project_id = {projectId:String}
          AND sd.started_at >= toDateTime({from:String})
          AND sd.started_at < toDateTime({to:String})
          ${userFilter}
        GROUP BY sd.session_id
        ${cursorClause}
        ORDER BY started_at ${direction === 'desc' ? 'DESC' : 'ASC'}, session_id ${direction === 'desc' ? 'DESC' : 'ASC'}
        LIMIT {fetchLimit:UInt32}`,
        {
          projectId,
          from,
          to,
          ...(user_id && { userId: user_id }),
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

      // Fetch session metadata and properties in parallel
      const [sessionRows, propsRows] = await Promise.all([
        queryClickHouse<{
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
            maxMerge(user_id) as user_id,
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
        ),
        queryClickHouse<{
          props_str: Record<string, string>;
          props_num: Record<string, number>;
          props_bool: Record<string, number>;
          server_props_str: Record<string, string>;
          server_props_num: Record<string, number>;
          server_props_bool: Record<string, number>;
        }>(
          `SELECT
            argMaxMerge(props_str) as props_str,
            argMaxMerge(props_num) as props_num,
            argMaxMerge(props_bool) as props_bool,
            argMaxMerge(server_props_str) as server_props_str,
            argMaxMerge(server_props_num) as server_props_num,
            argMaxMerge(server_props_bool) as server_props_bool
          FROM analytics.session_properties
          WHERE project_id = {projectId:String}
            AND session_id = {sessionId:String}
          GROUP BY session_id`,
          { projectId, sessionId },
        ),
      ]);

      const s = sessionRows[0];
      const p = propsRows[0];
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
            properties: p ? mergeProps(p) : {},
            serverProperties: p
              ? mergeProps({
                  props_str: p.server_props_str,
                  props_num: p.server_props_num,
                  props_bool: p.server_props_bool,
                })
              : {},
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
        path: string;
        props_str: string;
      }>(
        `SELECT
          event_id,
          event_name,
          timestamp,
          user_id,
          path,
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
      querystring: withDateRangeLimit(
        dateRangeSchema.extend({
          limit: z.coerce.number().min(1).max(200).default(50),
          cursor_ts: z.string().optional(),
          cursor_id: z.string().optional(),
        }),
      ),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { from, to, limit, cursor_ts, cursor_id } = request.query as {
        from: string;
        to: string;
        limit: number;
        cursor_ts?: string;
        cursor_id?: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const hasCursor = cursor_ts && cursor_id;
      const cursorClause = hasCursor
        ? `HAVING (last_seen, user_id) < (toDateTime({cursorTs:String}), {cursorId:String})`
        : '';

      const users = await queryClickHouse<{
        user_id: string;
        name: string;
        last_seen: string;
        events_in_period: string;
      }>(
        `SELECT
          u.user_id,
          (SELECT name FROM analytics.user_names FINAL
           WHERE project_id = {projectId:String} AND user_id = u.user_id
           LIMIT 1) AS name,
          max(u.last_seen) as last_seen,
          sum(u.total_events) as events_in_period
        FROM analytics.users AS u
        WHERE u.project_id = {projectId:String}
          AND u.user_id != ''
          AND u.last_seen >= toDateTime({from:String})
          AND u.last_seen < toDateTime({to:String})
        GROUP BY u.user_id
        ${cursorClause}
        ORDER BY last_seen DESC, user_id DESC
        LIMIT {fetchLimit:UInt32}`,
        {
          projectId,
          from,
          to,
          ...(hasCursor && { cursorTs: cursor_ts, cursorId: cursor_id }),
          fetchLimit: limit + 1,
        },
      );

      const hasMore = users.length > limit;
      const page = hasMore ? users.slice(0, limit) : users;

      return {
        users: page.map((u) => ({
          userId: u.user_id,
          name: u.name || null,
          lastSeen: u.last_seen,
          eventsInPeriod: Number(u.events_in_period),
        })),
        hasMore,
      };
    },
  });

  // ─── User Detail ───

  fastify.get('/projects/:projectId/users/:userId', {
    schema: {
      params: z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
      }),
    },
    handler: async (request, reply) => {
      const { projectId, userId } = request.params as {
        projectId: string;
        userId: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const rows = await queryClickHouse<{
        user_id: string;
        first_seen: string;
        last_seen: string;
        total_events: string;
        props_str: Record<string, string>;
        props_num: Record<string, number>;
        props_bool: Record<string, number>;
        server_props_str: Record<string, string>;
        server_props_num: Record<string, number>;
        server_props_bool: Record<string, number>;
      }>(
        `SELECT
          user_id,
          min(first_seen) as first_seen,
          max(last_seen) as last_seen,
          sum(total_events) as total_events,
          argMaxMerge(props_str) as props_str,
          argMaxMerge(props_num) as props_num,
          argMaxMerge(props_bool) as props_bool,
          argMaxMerge(server_props_str) as server_props_str,
          argMaxMerge(server_props_num) as server_props_num,
          argMaxMerge(server_props_bool) as server_props_bool
        FROM analytics.users
        WHERE project_id = {projectId:String}
          AND user_id = {userId:String}
        GROUP BY user_id`,
        { projectId, userId },
      );

      if (rows.length === 0) {
        return reply.notFound('User not found');
      }

      const u = rows[0];

      return {
        userId: u.user_id,
        firstSeen: u.first_seen,
        lastSeen: u.last_seen,
        totalEvents: Number(u.total_events),
        properties: mergeProps(u),
        serverProperties: mergeProps({
          props_str: u.server_props_str,
          props_num: u.server_props_num,
          props_bool: u.server_props_bool,
        }),
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
      querystring: withDateRangeLimit(
        querySchema
          .extend({
            user_id: z.string().optional(),
            session_id: z.string().optional(),
            limit: z.coerce.number().min(1).max(200).default(50),
            direction: z.enum(['asc', 'desc']).default('desc'),
            cursor_ts: z.string().optional(),
            cursor_id: z.string().optional(),
          })
          .passthrough(),
      ), // Allow prop_str.*, prop_num.*, prop_bool.* params
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
        path: string;
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
          path, browser, os, device_type, country,
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
      querystring: withDateRangeLimit(
        dateRangeSchema.extend({
          type: z.enum(['str', 'num', 'bool']),
          search: z.string().optional(),
          limit: z.coerce.number().min(1).max(200).default(50),
        }),
      ),
    },
    handler: async (request, reply) => {
      const { projectId, propertyName } = request.params as {
        projectId: string;
        propertyName: string;
      };
      const { from, to, type, search, limit } = request.query as {
        from: string;
        to: string;
        type: 'str' | 'num' | 'bool';
        search?: string;
        limit: number;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const colMap = {
        str: 'props_str',
        num: 'props_num',
        bool: 'props_bool',
      } as const;
      const col = colMap[type];

      const searchClause = search
        ? `AND ${col}[{name:String}] LIKE {search:String}`
        : '';

      const rows = await queryClickHouse<{ value: string }>(
        `SELECT DISTINCT toString(${col}[{name:String}]) as value
        FROM analytics.events
        WHERE project_id = {projectId:String}
          AND timestamp >= toDateTime({from:String})
          AND timestamp < toDateTime({to:String})
          AND mapContains(${col}, {name:String})
          ${searchClause}
        ORDER BY value
        LIMIT {limit:UInt32}`,
        {
          projectId,
          from,
          to,
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
      querystring: withDateRangeLimit(
        querySchema.extend({
          metric: z.enum(['events', 'users']).default('events'),
        }),
      ),
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
