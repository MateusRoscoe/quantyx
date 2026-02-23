import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '@quantyx/postgres';
import type { MemberRole } from '@quantyx/shared';

const ROLE_LEVEL: Record<string, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export interface OrgMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}

export default fp(async function authorization(fastify: FastifyInstance) {
  fastify.decorate(
    'verifyOrgMembership',
    async function verifyOrgMembership(
      request: FastifyRequest,
      orgId: string,
      opts?: { minRole?: MemberRole },
    ): Promise<OrgMembership> {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: request.userId,
            organizationId: orgId,
          },
        },
      });

      if (!membership) {
        throw fastify.httpErrors.forbidden(
          'You are not a member of this organization',
        );
      }

      const minRole = opts?.minRole ?? 'member';
      const required = ROLE_LEVEL[minRole] ?? 1;
      const actual = ROLE_LEVEL[membership.role] ?? 0;

      if (actual < required) {
        throw fastify.httpErrors.forbidden(
          `Requires at least ${minRole} role`,
        );
      }

      return membership;
    },
  );
});
