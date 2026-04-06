import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ServerGroupIdentifyBody,
  ServerGroupAssignBody,
  SYSTEM_EVENTS,
  GROUP_IDENTITY_KEYS,
} from '@quantyx/shared';
import { generateUUIDv7 } from '../helpers/uuid';
import { sendMessage, BackpressureError } from '../models/kafka';

export default async function groupRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/groups/identify', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      body: ServerGroupIdentifyBody,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as ServerGroupIdentifyBody;

      await fastify.verifyProjectAccess(request, projectId);

      const event = {
        event_id: generateUUIDv7(),
        session_id: '',
        user_id: '',
        event_name: SYSTEM_EVENTS.SERVER_GROUP_IDENTIFY,
        timestamp: new Date().toISOString(),
        project_id: projectId,
        props_str: {
          [GROUP_IDENTITY_KEYS.GROUP_TYPE]: body.groupType,
          [GROUP_IDENTITY_KEYS.GROUP_ID]: body.groupId,
          ...body.props_str,
        },
        props_num: body.props_num ?? {},
        props_bool: body.props_bool ?? {},
      };

      try {
        sendMessage(Buffer.from(JSON.stringify(event)));
      } catch (err) {
        if (err instanceof BackpressureError) {
          return reply.serviceUnavailable(err.message);
        }
        throw err;
      }

      return reply.status(202).send({ status: 'accepted' });
    },
  });

  fastify.post('/projects/:projectId/groups/assign', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      body: ServerGroupAssignBody,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as ServerGroupAssignBody;

      await fastify.verifyProjectAccess(request, projectId);

      const event = {
        event_id: generateUUIDv7(),
        session_id: '',
        user_id: body.userId,
        event_name: SYSTEM_EVENTS.GROUP_ASSIGN,
        timestamp: new Date().toISOString(),
        project_id: projectId,
        props_str: {
          [GROUP_IDENTITY_KEYS.GROUP_TYPE]: body.groupType,
          [GROUP_IDENTITY_KEYS.GROUP_ID]: body.groupId,
        },
        props_num: {},
        props_bool: {},
      };

      try {
        sendMessage(Buffer.from(JSON.stringify(event)));
      } catch (err) {
        if (err instanceof BackpressureError) {
          return reply.serviceUnavailable(err.message);
        }
        throw err;
      }

      return reply.status(202).send({ status: 'accepted' });
    },
  });
}
