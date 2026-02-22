import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

jest.mock('@quantyx/postgres', () => ({
  prisma: {
    $connect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

import { app } from './app';

describe('GET /healthz', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    server.setValidatorCompiler(validatorCompiler);
    server.setSerializerCompiler(serializerCompiler);
    server.register(app);
  });

  afterEach(async () => {
    await server.close();
  });

  it('should return alive status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/healthz',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('alive');
    expect(body.db).toBeDefined();
  });
});
