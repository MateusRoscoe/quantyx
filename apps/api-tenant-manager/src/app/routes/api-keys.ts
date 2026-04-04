import { z } from 'zod';
import { prisma } from '@quantyx/postgres';
import {
  ApiKeyBody,
  ApiKeyResponse,
  ApiKeyCreatedResponse,
} from '@quantyx/shared';
import { generateApiKey } from '@quantyx/shared-backend';
import { ErrorResponseSchema } from '../../helpers/error-schema';
import type { server } from '../../main';

const ProjectIdParams = z.object({ projectId: z.string().uuid() });
const IdParams = z.object({ id: z.string().uuid() });

function toResponse(apiKey: {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: apiKey.id,
    projectId: apiKey.projectId,
    organizationId: apiKey.organizationId,
    name: apiKey.name,
    prefix: apiKey.prefix,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString(),
  };
}

export default async function (fastify: server) {
  fastify.route({
    method: 'GET',
    url: '/projects/:projectId/api-keys',
    schema: {
      tags: ['API Keys'],
      params: ProjectIdParams,
      response: {
        200: z.array(ApiKeyResponse),
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.projectId, deletedAt: null },
        select: { organizationId: true },
      });
      if (!project) {
        return reply.notFound('Project not found');
      }
      await fastify.verifyOrgMembership(request, project.organizationId);
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          projectId: request.params.projectId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      return apiKeys.map(toResponse);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/projects/:projectId/api-keys',
    schema: {
      tags: ['API Keys'],
      params: ProjectIdParams,
      body: ApiKeyBody,
      response: {
        201: ApiKeyCreatedResponse,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.projectId, deletedAt: null },
        select: { id: true, organizationId: true },
      });
      if (!project) {
        return reply.notFound('Project not found');
      }
      await fastify.verifyOrgMembership(request, project.organizationId, {
        minRole: 'admin',
      });

      const { key, prefix, keyHash } = generateApiKey();

      const apiKey = await prisma.apiKey.create({
        data: {
          projectId: project.id,
          organizationId: project.organizationId,
          name: request.body.name,
          prefix,
          keyHash,
          expiresAt: request.body.expiresAt
            ? new Date(request.body.expiresAt)
            : null,
        },
      });

      return reply.status(201).send({
        ...toResponse(apiKey),
        key,
      });
    },
  });

  fastify.route({
    method: 'GET',
    url: '/api-keys/:id',
    schema: {
      tags: ['API Keys'],
      params: IdParams,
      response: {
        200: ApiKeyResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!apiKey) {
        return reply.notFound('API key not found');
      }
      await fastify.verifyOrgMembership(request, apiKey.organizationId);
      return toResponse(apiKey);
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/api-keys/:id',
    schema: {
      tags: ['API Keys'],
      params: IdParams,
      response: {
        204: z.null(),
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const existing = await prisma.apiKey.findFirst({
        where: { id: request.params.id, deletedAt: null },
        select: { organizationId: true },
      });
      if (!existing) {
        return reply.notFound('API key not found');
      }
      await fastify.verifyOrgMembership(request, existing.organizationId, {
        minRole: 'admin',
      });
      const { count } = await prisma.apiKey.updateMany({
        where: { id: request.params.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (count === 0) {
        return reply.notFound('API key not found');
      }
      return reply.status(204).send(null);
    },
  });
}
