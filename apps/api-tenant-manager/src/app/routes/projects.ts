import { z } from 'zod';
import { prisma } from '@quantyx/postgres';
import { ProjectBody, ProjectResponse } from '@quantyx/shared';
import { ErrorResponseSchema } from '../../helpers/error-schema';
import type { server } from '../../main';

const IdParamsSchema = z.object({ id: z.string().uuid() });
const OrgIdParamsSchema = z.object({ orgId: z.string().uuid() });

function toResponse(project: {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export default async function (fastify: server) {
  fastify.route({
    method: 'GET',
    url: '/organizations/:orgId/projects',
    schema: {
      tags: ['Projects'],
      params: OrgIdParamsSchema,
      response: {
        200: z.array(ProjectResponse),
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request) => {
      await fastify.verifyOrgMembership(request, request.params.orgId);
      const projects = await prisma.project.findMany({
        where: { organizationId: request.params.orgId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return projects.map(toResponse);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/organizations/:orgId/projects',
    schema: {
      tags: ['Projects'],
      params: OrgIdParamsSchema,
      body: ProjectBody,
      response: {
        201: ProjectResponse,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const org = await prisma.organization.findFirst({
        where: { id: request.params.orgId, deletedAt: null },
      });
      if (!org) {
        return reply.notFound('Organization not found');
      }
      await fastify.verifyOrgMembership(request, org.id);
      const project = await prisma.project.create({
        data: {
          name: request.body.name,
          organizationId: request.params.orgId,
        },
      });
      return reply.status(201).send(toResponse(project));
    },
  });

  fastify.route({
    method: 'GET',
    url: '/projects/:id',
    schema: {
      tags: ['Projects'],
      params: IdParamsSchema,
      response: {
        200: ProjectResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!project) {
        return reply.notFound('Project not found');
      }
      await fastify.verifyOrgMembership(request, project.organizationId);
      return toResponse(project);
    },
  });

  fastify.route({
    method: 'PATCH',
    url: '/projects/:id',
    schema: {
      tags: ['Projects'],
      params: IdParamsSchema,
      body: ProjectBody.partial(),
      response: {
        200: ProjectResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const existing = await prisma.project.findFirst({
        where: { id: request.params.id, deletedAt: null },
        select: { organizationId: true },
      });
      if (!existing) {
        return reply.notFound('Project not found');
      }
      await fastify.verifyOrgMembership(request, existing.organizationId, {
        minRole: 'admin',
      });
      const { count } = await prisma.project.updateMany({
        where: { id: request.params.id, deletedAt: null },
        data: request.body,
      });
      if (count === 0) {
        return reply.notFound('Project not found');
      }
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      return toResponse(project);
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/projects/:id',
    schema: {
      tags: ['Projects'],
      params: IdParamsSchema,
      response: {
        204: z.null(),
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const existing = await prisma.project.findFirst({
        where: { id: request.params.id, deletedAt: null },
        select: { organizationId: true },
      });
      if (!existing) {
        return reply.notFound('Project not found');
      }
      await fastify.verifyOrgMembership(request, existing.organizationId, {
        minRole: 'admin',
      });
      const { count } = await prisma.project.updateMany({
        where: { id: request.params.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (count === 0) {
        return reply.notFound('Project not found');
      }
      return reply.status(204).send(null);
    },
  });
}
