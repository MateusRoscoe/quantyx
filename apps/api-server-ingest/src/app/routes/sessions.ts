import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ServerSessionSetBody, SYSTEM_EVENTS } from '@quantyx/shared';
import { generateUUIDv7 } from '../helpers/uuid';
import { sendMessage, BackpressureError } from '../models/kafka';

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/sessions/set', {
    schema: {
      params: z.object({ projectId: z.string().uuid() }),
      body: ServerSessionSetBody,
    },
    handler: async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as ServerSessionSetBody;

      await fastify.verifyProjectAccess(request, projectId);

      const event = {
        event_id: generateUUIDv7(),
        session_id: body.sessionId,
        user_id: '',
        event_name: SYSTEM_EVENTS.SERVER_SESSION_SET,
        timestamp: new Date().toISOString(),
        project_id: projectId,
        props_str: body.props_str ?? {},
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
}
