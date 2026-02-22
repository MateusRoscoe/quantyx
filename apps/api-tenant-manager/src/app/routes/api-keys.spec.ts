import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { prisma } from '@quantyx/postgres';
import { app } from '../app';
import { AuthContext, createAuthenticatedUser } from '../../test-utils/auth-helper';

let server: FastifyInstance;
let authCtx: AuthContext;

beforeAll(async () => {
  server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(app);
  await server.ready();

  authCtx = await createAuthenticatedUser(server, 'apikeys-test@example.com');
});

beforeEach(async () => {
  // Cascade: Organization → Project → ApiKey
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await prisma.user.deleteMany({});
  await server.close();
  await prisma.$disconnect();
});

async function createOrgAndProject() {
  const org = await prisma.organization.create({ data: { name: 'Test Org' } });
  const project = await prisma.project.create({
    data: { name: 'Test Project', organizationId: org.id },
  });
  return { org, project };
}

describe('GET /projects/:projectId/api-keys', () => {
  it('returns empty list when no API keys exist', async () => {
    const { project } = await createOrgAndProject();
    const response = await server.inject({
      method: 'GET',
      url: `/projects/${project.id}/api-keys`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('excludes soft-deleted API keys', async () => {
    const { org, project } = await createOrgAndProject();
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        name: 'Active Key',
        prefix: 'qx_active12',
        keyHash: 'hash_active',
      },
    });
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        name: 'Deleted Key',
        prefix: 'qx_deleted12',
        keyHash: 'hash_deleted',
        deletedAt: new Date(),
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/projects/${project.id}/api-keys`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Active Key');
  });
});

describe('POST /projects/:projectId/api-keys', () => {
  it('creates an API key and returns plaintext key once', async () => {
    const { project, org } = await createOrgAndProject();
    const response = await server.inject({
      method: 'POST',
      url: `/projects/${project.id}/api-keys`,
      payload: { name: 'My Key' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeDefined();
    expect(body.projectId).toBe(project.id);
    expect(body.organizationId).toBe(org.id);
    expect(body.name).toBe('My Key');
    expect(body.prefix).toBeDefined();
    expect(body.key).toBeDefined();
    expect(body.key).toMatch(/^qx_/);
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
    expect(body.lastUsedAt).toBeNull();
    expect(body.expiresAt).toBeNull();
  });

  it('creates an API key with expiresAt', async () => {
    const { project } = await createOrgAndProject();
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const response = await server.inject({
      method: 'POST',
      url: `/projects/${project.id}/api-keys`,
      payload: { name: 'Expiring Key', expiresAt },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.expiresAt).toBeDefined();
  });

  it('returns 404 for unknown project', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/projects/00000000-0000-0000-0000-000000000000/api-keys',
      payload: { name: 'Ghost Key' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });

  it('subsequent GET does not include key field', async () => {
    const { project } = await createOrgAndProject();
    const createResponse = await server.inject({
      method: 'POST',
      url: `/projects/${project.id}/api-keys`,
      payload: { name: 'Check Key' },
      headers: authCtx.headers,
    });
    const created = createResponse.json();

    const getResponse = await server.inject({
      method: 'GET',
      url: `/api-keys/${created.id}`,
      headers: authCtx.headers,
    });
    expect(getResponse.statusCode).toBe(200);
    const body = getResponse.json();
    expect(body.key).toBeUndefined();
    expect(body.name).toBe('Check Key');
  });
});

describe('GET /api-keys/:id', () => {
  it('returns API key metadata by id', async () => {
    const { org, project } = await createOrgAndProject();
    const apiKey = await prisma.apiKey.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        name: 'Lookup Key',
        prefix: 'qx_lookup12',
        keyHash: 'hash_lookup',
      },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/api-keys/${apiKey.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(apiKey.id);
    expect(body.name).toBe('Lookup Key');
  });

  it('returns 404 for unknown id', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api-keys/00000000-0000-0000-0000-000000000000',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /api-keys/:id', () => {
  it('soft-deletes API key and returns 204', async () => {
    const { org, project } = await createOrgAndProject();
    const apiKey = await prisma.apiKey.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        name: 'To Revoke',
        prefix: 'qx_revoke12',
        keyHash: 'hash_revoke',
      },
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/api-keys/${apiKey.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(204);

    const record = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
    expect(record).not.toBeNull();
    expect(record!.deletedAt).not.toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/api-keys/00000000-0000-0000-0000-000000000000',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when deleting an already revoked key', async () => {
    const { org, project } = await createOrgAndProject();
    const apiKey = await prisma.apiKey.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        name: 'Already Revoked',
        prefix: 'qx_alrrev12',
        keyHash: 'hash_already_revoked',
        deletedAt: new Date(),
      },
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/api-keys/${apiKey.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});
