import { z } from 'zod';
import { prisma, Prisma } from '@quantyx/postgres';
import {
  AddMemberBody,
  UpdateMemberRoleBody,
  MemberResponse,
  type MemberRole,
} from '@quantyx/shared';
import { ErrorResponseSchema } from '../../helpers/error-schema';
import type { server } from '../../main';

const OrgIdParams = z.object({ orgId: z.string().uuid() });
const MemberParams = z.object({
  orgId: z.string().uuid(),
  id: z.string().uuid(),
});

function toResponse(member: {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return {
    id: member.id,
    userId: member.userId,
    organizationId: member.organizationId,
    role: member.role as MemberRole,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
    },
  };
}

export default async function (fastify: server) {
  fastify.route({
    method: 'GET',
    url: '/organizations/:orgId/members',
    schema: {
      tags: ['Members'],
      params: OrgIdParams,
      response: {
        200: z.array(MemberResponse),
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request) => {
      await fastify.verifyOrgMembership(request, request.params.orgId);
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: request.params.orgId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return members.map(toResponse);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/organizations/:orgId/members',
    schema: {
      tags: ['Members'],
      params: OrgIdParams,
      body: AddMemberBody,
      response: {
        201: MemberResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      await fastify.verifyOrgMembership(request, request.params.orgId, {
        minRole: 'admin',
      });

      const user = await prisma.user.findUnique({
        where: { email: request.body.email },
      });
      if (!user) {
        return reply.notFound('User not found');
      }

      try {
        const member = await prisma.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: request.params.orgId,
            role: request.body.role,
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        return reply.status(201).send(toResponse(member));
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return reply.conflict(
            'User is already a member of this organization',
          );
        }
        throw error;
      }
    },
  });

  fastify.route({
    method: 'PATCH',
    url: '/organizations/:orgId/members/:id',
    schema: {
      tags: ['Members'],
      params: MemberParams,
      body: UpdateMemberRoleBody,
      response: {
        200: MemberResponse,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      await fastify.verifyOrgMembership(request, request.params.orgId, {
        minRole: 'owner',
      });

      const member = await prisma.organizationMember.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.params.orgId,
        },
        select: { id: true, role: true },
      });
      if (!member) {
        return reply.notFound('Member not found');
      }
      if (member.role === 'owner') {
        return reply.forbidden("Cannot change the owner's role");
      }

      const updated = await prisma.organizationMember.update({
        where: { id: request.params.id },
        data: { role: request.body.role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return toResponse(updated);
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/organizations/:orgId/members/:id',
    schema: {
      tags: ['Members'],
      params: MemberParams,
      response: {
        204: z.null(),
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      await fastify.verifyOrgMembership(request, request.params.orgId, {
        minRole: 'owner',
      });

      const member = await prisma.organizationMember.findFirst({
        where: {
          id: request.params.id,
          organizationId: request.params.orgId,
        },
        select: { id: true, role: true },
      });
      if (!member) {
        return reply.notFound('Member not found');
      }
      if (member.role === 'owner') {
        return reply.forbidden('Cannot remove the owner');
      }

      await prisma.organizationMember.delete({
        where: { id: request.params.id },
      });
      return reply.status(204).send(null);
    },
  });
}
