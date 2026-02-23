import { z } from 'zod';
import { prisma } from '@quantyx/postgres';
import {
  OrganizationBody,
  OrganizationResponse,
} from '@quantyx/shared';
import { ErrorResponseSchema } from '../../helpers/error-schema';
import type { server } from '../../main';

const ParamsSchema = z.object({ id: z.string().uuid() });

function toResponse(org: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: org.id,
    name: org.name,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export default async function (fastify: server) {
  fastify.route({
    method: 'GET',
    url: '/organizations',
    schema: {
      tags: ['Organizations'],
      response: {
        200: z.array(OrganizationResponse),
        500: ErrorResponseSchema,
      },
    },
    handler: async (request) => {
      const orgs = await prisma.organization.findMany({
        where: {
          deletedAt: null,
          members: { some: { userId: request.userId } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return orgs.map(toResponse);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/organizations',
    schema: {
      tags: ['Organizations'],
      body: OrganizationBody,
      response: {
        201: OrganizationResponse,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const org = await prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
          data: { name: request.body.name },
        });
        await tx.organizationMember.create({
          data: {
            userId: request.userId,
            organizationId: created.id,
            role: 'owner',
          },
        });
        return created;
      });
      return reply.status(201).send(toResponse(org));
    },
  });

  fastify.route({
    method: 'GET',
    url: '/organizations/:id',
    schema: {
      tags: ['Organizations'],
      params: ParamsSchema,
      response: {
        200: OrganizationResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const org = await prisma.organization.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!org) {
        return reply.notFound('Organization not found');
      }
      await fastify.verifyOrgMembership(request, org.id);
      return toResponse(org);
    },
  });

  fastify.route({
    method: 'PATCH',
    url: '/organizations/:id',
    schema: {
      tags: ['Organizations'],
      params: ParamsSchema,
      body: OrganizationBody.partial(),
      response: {
        200: OrganizationResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const existing = await prisma.organization.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!existing) {
        return reply.notFound('Organization not found');
      }
      await fastify.verifyOrgMembership(request, existing.id, {
        minRole: 'admin',
      });
      const org = await prisma.organization.update({
        where: { id: request.params.id },
        data: request.body,
      });
      return toResponse(org);
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/organizations/:id',
    schema: {
      tags: ['Organizations'],
      params: ParamsSchema,
      response: {
        204: z.null(),
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const existing = await prisma.organization.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!existing) {
        return reply.notFound('Organization not found');
      }
      await fastify.verifyOrgMembership(request, existing.id, {
        minRole: 'admin',
      });
      await prisma.organization.update({
        where: { id: request.params.id },
        data: { deletedAt: new Date() },
      });
      return reply.status(204).send(null);
    },
  });
}
