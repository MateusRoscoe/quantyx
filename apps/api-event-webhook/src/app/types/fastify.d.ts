import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    projectId: string;
    organizationId: string;
  }
}
