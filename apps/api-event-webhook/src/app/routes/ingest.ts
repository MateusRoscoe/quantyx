import { sendMessages, BackpressureError } from '../models/kafka';
import * as z from 'zod';

import { EventMessageInput, MAX_USER_AGENT_LENGTH } from '@quantyx/shared';

import type { server } from '../../main';
import { ErrorResponseSchema } from '../helpers/error-schema';

export default async function (fastify: server) {
  fastify.route({
    method: 'POST',
    url: '/ingest',
    schema: {
      tags: ['Ingest'],
      body: EventMessageInput,
      response: {
        204: z.null(),
        400: ErrorResponseSchema,
        503: z.object({
          message: z.string(),
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        sendMessages([
          Buffer.from(
            JSON.stringify({
              ...request.body,
              project_id: request.projectId,
              ip_address: request.ip,
              user_agent:
                request.headers['user-agent']?.slice(
                  0,
                  MAX_USER_AGENT_LENGTH,
                ) || undefined,
            }),
          ),
        ]);
        reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BackpressureError) {
          reply.status(503).send({
            message: error.message,
            error: 'Service Unavailable',
          });
          return;
        }
        throw error;
      }
    },
  });

  fastify.route({
    method: 'POST',
    url: '/ingest-bulk',
    schema: {
      tags: ['Ingest'],
      body: z.array(EventMessageInput),
      response: {
        204: z.null(),
        400: ErrorResponseSchema,
        503: z.object({
          message: z.string(),
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const userAgent =
          request.headers['user-agent']?.slice(0, MAX_USER_AGENT_LENGTH) ||
          undefined;

        sendMessages(
          request.body.map((event) =>
            Buffer.from(
              JSON.stringify({
                ...event,
                project_id: request.projectId,
                ip_address: request.ip,
                user_agent: userAgent,
              }),
            ),
          ),
        );
        reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BackpressureError) {
          reply.status(503).send({
            message: error.message,
            error: 'Service Unavailable',
          });
          return;
        }
        throw error;
      }
    },
  });
}
