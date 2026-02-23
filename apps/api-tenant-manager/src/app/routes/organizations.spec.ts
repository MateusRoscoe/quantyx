import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { prisma } from '@quantyx/postgres';
import { app } from '../app';
import {
  AuthContext,
  createAuthenticatedUser,
} from '../../test-utils/auth-helper';

let server: FastifyInstance;
let authCtx: AuthContext;

beforeAll(async () => {
  server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(app);
  await server.ready();

  authCtx = await createAuthenticatedUser(server);
});

beforeEach(async () => {
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await prisma.user.deleteMany({});
  await server.close();
  await prisma.$disconnect();
});

describe('GET /organizations', () => {
  it('returns empty list when no organizations exist', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/organizations',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('excludes soft-deleted organizations', async () => {
    const org = await prisma.organization.create({ data: { name: 'Visible' } });
    await prisma.organization.create({
      data: { name: 'Deleted', deletedAt: new Date() },
    });
    const response = await server.inject({
      method: 'GET',
      url: '/organizations',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(org.id);
  });

  it('returns 401 without session', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/organizations',
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /organizations', () => {
  it('creates an organization and returns 201', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/organizations',
      payload: { name: 'Acme Corp' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Acme Corp');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('returns 400 for empty name', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/organizations',
      payload: { name: '' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for missing name', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/organizations',
      payload: {},
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /organizations/:id', () => {
  it('returns the organization by id', async () => {
    const org = await prisma.organization.create({ data: { name: 'Globex' } });
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(org.id);
    expect(body.name).toBe('Globex');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('returns 404 for unknown UUID', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/organizations/00000000-0000-0000-0000-000000000000',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 for a soft-deleted organization', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Gone', deletedAt: new Date() },
    });
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /organizations/:id', () => {
  it('updates the organization name and returns 200', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Old Name' },
    });
    const response = await server.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}`,
      payload: { name: 'New Name' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('New Name');
    expect(body.updatedAt).not.toBe(body.createdAt);
  });

  it('returns 404 for unknown UUID', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: '/organizations/00000000-0000-0000-0000-000000000000',
      payload: { name: 'Anything' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /organizations/:id', () => {
  it('soft deletes and returns 204, record remains with deletedAt set', async () => {
    const org = await prisma.organization.create({
      data: { name: 'ToDelete' },
    });
    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(204);

    const record = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(record).not.toBeNull();
    expect(record?.deletedAt).not.toBeNull();
  });

  it('returns 404 for unknown UUID', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/organizations/00000000-0000-0000-0000-000000000000',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when deleting an already soft-deleted organization', async () => {
    const org = await prisma.organization.create({
      data: { name: 'AlreadyGone', deletedAt: new Date() },
    });
    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});
