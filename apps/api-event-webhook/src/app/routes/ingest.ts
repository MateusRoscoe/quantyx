import { sendEvent, sendEventBulk, BufferFullError } from '../models/kafka';
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
        500: z.object({
          message: z.string(),
          error: z.string(),
        }),
        503: z.object({
          message: z.string(),
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const eventData = {
          ...request.body,
          project_id: request.projectId,
          ip_address: request.ip,
          user_agent:
            request.headers['user-agent']?.slice(0, MAX_USER_AGENT_LENGTH) ||
            undefined,
        };
        sendEvent(eventData);
        reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BufferFullError) {
          reply.status(503).send({
            message: 'API is at capacity. Please try again later.',
            error: 'Service Unavailable',
          });
          return;
        }
        fastify.log.error(error, `Failed to send event to Kafka`);
        reply
          .status(500)
          .send({ message: 'Failed to ingest event', error: 'Internal Error' });
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
        500: z.object({
          message: z.string(),
          error: z.string(),
        }),
        503: z.object({
          message: z.string(),
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const events = request.body.map((event) => ({
          ...event,
          project_id: request.projectId,
          ip_address: request.ip,
          user_agent:
            request.headers['user-agent']?.slice(0, MAX_USER_AGENT_LENGTH) ||
            undefined,
        }));
        sendEventBulk(events);
        reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BufferFullError) {
          reply.status(503).send({
            message: 'API is at capacity. Please try again later.',
            error: 'Service Unavailable',
          });
          return;
        }
        fastify.log.error(error, `Failed to send event to Kafka`);
        reply
          .status(500)
          .send({ message: 'Failed to ingest event', error: 'Internal Error' });
      }
    },
  });
}
