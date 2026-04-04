import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '@quantyx/postgres';

export default fp(async function authorization(fastify: FastifyInstance) {
  fastify.decorate(
    'verifyProjectAccess',
    async function verifyProjectAccess(
      request: FastifyRequest,
      projectId: string,
    ): Promise<{ organizationId: string }> {
      const project = await prisma.project.findUnique({
        where: { id: projectId, deletedAt: null },
        select: {
          organizationId: true,
          organization: {
            select: {
              members: {
                where: { userId: request.userId },
                select: { id: true },
              },
            },
          },
        },
      });

      if (!project) {
        throw fastify.httpErrors.notFound('Project not found');
      }

      if (project.organization.members.length === 0) {
        throw fastify.httpErrors.forbidden(
          'You are not a member of this organization',
        );
      }

      return { organizationId: project.organizationId };
    },
  );
});
