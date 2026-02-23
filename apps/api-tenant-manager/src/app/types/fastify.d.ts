import 'fastify';
import type { MemberRole } from '@quantyx/shared';
import type { OrgMembership } from '../plugins/04-authorization';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    userName: string;
  }

  interface FastifyInstance {
    verifyOrgMembership(
      request: FastifyRequest,
      orgId: string,
      opts?: { minRole?: MemberRole },
    ): Promise<OrgMembership>;
  }
}
