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
      // Find the project and verify user has org membership
      const project = await prisma.project.findUnique({
        where: { id: projectId, deletedAt: null },
        select: { organizationId: true },
      });

      if (!project) {
        throw fastify.httpErrors.notFound('Project not found');
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: request.userId,
            organizationId: project.organizationId,
          },
        },
      });

      if (!membership) {
        throw fastify.httpErrors.forbidden(
          'You are not a member of this organization',
        );
      }

      return { organizationId: project.organizationId };
    },
  );
});
