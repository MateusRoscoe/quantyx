import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryClickHouse } from '../../helpers/query';

function mergeProps(row: {
  props_str?: Record<string, string>;
  props_num?: Record<string, number>;
  props_bool?: Record<string, number>;
}): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(row.props_str ?? {})) result[k] = v;
  for (const [k, v] of Object.entries(row.props_num ?? {})) result[k] = v;
  for (const [k, v] of Object.entries(row.props_bool ?? {})) {
    result[k] = v === 1;
  }
  return result;
}

function encodeCursor(groupType: string, groupId: string): string {
  return Buffer.from(JSON.stringify({ t: groupType, i: groupId })).toString(
    'base64url',
  );
}

const CursorSchema = z.object({ t: z.string(), i: z.string() });

function decodeCursor(cursor: string): { t: string; i: string } {
  const raw = Buffer.from(cursor, 'base64url').toString();
  return CursorSchema.parse(JSON.parse(raw));
}

export default async function groupRoutes(fastify: FastifyInstance) {
  // ─── List groups ───
  fastify.get('/projects/:projectId/groups', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      querystring: z.object({
        group_type: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { group_type, limit, cursor } = request.query as {
        group_type?: string;
        limit: number;
        cursor?: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const typeFilter = group_type
        ? 'AND group_type = {groupType:String}'
        : '';

      let cursorFilter = '';
      const params: Record<string, string | number> = { projectId, limit };
      if (group_type) params.groupType = group_type;

      if (cursor) {
        try {
          const decoded = decodeCursor(cursor);
          cursorFilter =
            'AND (group_type, group_id) > ({cursorType:String}, {cursorId:String})';
          params.cursorType = decoded.t;
          params.cursorId = decoded.i;
        } catch {
          return reply.badRequest('Invalid cursor');
        }
      }

      const rows = await queryClickHouse<{
        group_type: string;
        group_id: string;
        first_seen: string;
        last_seen: string;
        name: string;
      }>(
        `SELECT
          g.group_type,
          g.group_id,
          min(g.first_seen) as first_seen,
          max(g.last_seen) as last_seen,
          (SELECT name FROM analytics.group_names FINAL
           WHERE project_id = {projectId:String}
             AND group_type = g.group_type AND group_id = g.group_id
           LIMIT 1) AS name
        FROM analytics.groups AS g
        WHERE g.project_id = {projectId:String}
          ${typeFilter}
          ${cursorFilter}
        GROUP BY g.group_type, g.group_id
        ORDER BY g.group_type, g.group_id
        LIMIT {limit:UInt32}`,
        params,
      );

      const nextCursor =
        rows.length === limit
          ? encodeCursor(
              rows[rows.length - 1].group_type,
              rows[rows.length - 1].group_id,
            )
          : null;

      return {
        groups: rows.map((r) => ({
          groupType: r.group_type,
          groupId: r.group_id,
          name: r.name || null,
          firstSeen: r.first_seen,
          lastSeen: r.last_seen,
        })),
        nextCursor,
      };
    },
  });

  // ─── Group detail ───
  fastify.get('/projects/:projectId/groups/:groupType/:groupId', {
    schema: {
      params: z.object({
        projectId: z.string().uuid(),
        groupType: z.string(),
        groupId: z.string(),
      }),
    },
    handler: async (request, reply) => {
      const { projectId, groupType, groupId } = request.params as {
        projectId: string;
        groupType: string;
        groupId: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const rows = await queryClickHouse<{
        group_type: string;
        group_id: string;
        first_seen: string;
        last_seen: string;
        props_str: Record<string, string>;
        props_num: Record<string, number>;
        props_bool: Record<string, number>;
        server_props_str: Record<string, string>;
        server_props_num: Record<string, number>;
        server_props_bool: Record<string, number>;
      }>(
        `SELECT
          group_type,
          group_id,
          min(first_seen) as first_seen,
          max(last_seen) as last_seen,
          argMaxMerge(props_str) as props_str,
          argMaxMerge(props_num) as props_num,
          argMaxMerge(props_bool) as props_bool,
          argMaxMerge(server_props_str) as server_props_str,
          argMaxMerge(server_props_num) as server_props_num,
          argMaxMerge(server_props_bool) as server_props_bool
        FROM analytics.groups
        WHERE project_id = {projectId:String}
          AND group_type = {groupType:String}
          AND group_id = {groupId:String}
        GROUP BY group_type, group_id`,
        { projectId, groupType, groupId },
      );

      if (rows.length === 0) {
        return reply.notFound('Group not found');
      }

      const g = rows[0];
      return {
        groupType: g.group_type,
        groupId: g.group_id,
        firstSeen: g.first_seen,
        lastSeen: g.last_seen,
        properties: mergeProps(g),
        serverProperties: mergeProps({
          props_str: g.server_props_str,
          props_num: g.server_props_num,
          props_bool: g.server_props_bool,
        }),
      };
    },
  });

  // ─── Users in a group ───
  fastify.get('/projects/:projectId/groups/:groupType/:groupId/users', {
    schema: {
      params: z.object({
        projectId: z.string().uuid(),
        groupType: z.string(),
        groupId: z.string(),
      }),
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    },
    handler: async (request) => {
      const { projectId, groupType, groupId } = request.params as {
        projectId: string;
        groupType: string;
        groupId: string;
      };
      const { limit, cursor } = request.query as {
        limit: number;
        cursor?: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const cursorFilter = cursor
        ? 'AND user_id > {cursor:String}'
        : '';

      const rows = await queryClickHouse<{
        user_id: string;
        assigned_at: string;
      }>(
        `SELECT
          user_id,
          min(assigned_at) as assigned_at
        FROM analytics.user_groups
        WHERE project_id = {projectId:String}
          AND group_type = {groupType:String}
          AND group_id = {groupId:String}
          ${cursorFilter}
        GROUP BY user_id
        ORDER BY user_id
        LIMIT {limit:UInt32}`,
        {
          projectId,
          groupType,
          groupId,
          ...(cursor ? { cursor } : {}),
          limit,
        },
      );

      return {
        users: rows.map((r) => ({
          userId: r.user_id,
          assignedAt: r.assigned_at,
        })),
        nextCursor:
          rows.length === limit ? rows[rows.length - 1].user_id : null,
      };
    },
  });

  // ─── Groups for a user ───
  fastify.get('/projects/:projectId/users/:userId/groups', {
    schema: {
      params: z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
      }),
    },
    handler: async (request) => {
      const { projectId, userId } = request.params as {
        projectId: string;
        userId: string;
      };

      await fastify.verifyProjectAccess(request, projectId);

      const rows = await queryClickHouse<{
        group_type: string;
        group_id: string;
        assigned_at: string;
      }>(
        `SELECT
          group_type,
          group_id,
          min(assigned_at) as assigned_at
        FROM analytics.user_groups
        WHERE project_id = {projectId:String}
          AND user_id = {userId:String}
        GROUP BY group_type, group_id
        ORDER BY group_type, group_id`,
        { projectId, userId },
      );

      return {
        groups: rows.map((r) => ({
          groupType: r.group_type,
          groupId: r.group_id,
          assignedAt: r.assigned_at,
        })),
      };
    },
  });
}
