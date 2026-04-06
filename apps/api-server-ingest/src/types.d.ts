import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }

  interface FastifyInstance {
    verifyProjectAccess(
      request: FastifyRequest,
      projectId: string,
    ): Promise<{ organizationId: string }>;
  }
}
