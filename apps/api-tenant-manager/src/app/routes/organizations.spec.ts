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
  createOrgWithOwner,
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

  it('returns only organizations the user is a member of', async () => {
    const myOrg = await createOrgWithOwner(authCtx.userId, 'My Org');
    // Create an org with no membership for this user
    await prisma.organization.create({ data: { name: 'Other Org' } });

    const response = await server.inject({
      method: 'GET',
      url: '/organizations',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(myOrg.id);
  });

  it('excludes soft-deleted organizations', async () => {
    await createOrgWithOwner(authCtx.userId, 'Visible');
    const deleted = await createOrgWithOwner(authCtx.userId, 'Deleted');
    await prisma.organization.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date() },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/organizations',
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Visible');
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
  it('creates an organization with the caller as owner', async () => {
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

    // Verify owner membership was created
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: authCtx.userId,
          organizationId: body.id,
        },
      },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('owner');
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
    const org = await createOrgWithOwner(authCtx.userId, 'Globex');
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

  it('returns 403 for non-member', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Not Mine' },
    });
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(403);
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
    const org = await createOrgWithOwner(authCtx.userId, 'Gone');
    await prisma.organization.update({
      where: { id: org.id },
      data: { deletedAt: new Date() },
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
    const org = await createOrgWithOwner(authCtx.userId, 'Old Name');
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

  it('returns 403 for members (requires admin)', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Restricted' },
    });
    await prisma.organizationMember.create({
      data: {
        userId: authCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });
    const response = await server.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}`,
      payload: { name: 'Anything' },
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(403);
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
    const org = await createOrgWithOwner(authCtx.userId, 'ToDelete');
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

  it('returns 403 for members (requires admin)', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Restricted' },
    });
    await prisma.organizationMember.create({
      data: {
        userId: authCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });
    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(403);
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
    const org = await createOrgWithOwner(authCtx.userId, 'AlreadyGone');
    await prisma.organization.update({
      where: { id: org.id },
      data: { deletedAt: new Date() },
    });
    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}`,
      headers: authCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});
