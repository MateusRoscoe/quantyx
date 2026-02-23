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
let ownerCtx: AuthContext;
let otherCtx: AuthContext;

beforeAll(async () => {
  server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(app);
  await server.ready();

  ownerCtx = await createAuthenticatedUser(
    server,
    'members-owner@example.com',
    'Password123!',
    'Owner User',
  );
  otherCtx = await createAuthenticatedUser(
    server,
    'members-other@example.com',
    'Password123!',
    'Other User',
  );
});

beforeEach(async () => {
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await prisma.user.deleteMany({});
  await server.close();
  await prisma.$disconnect();
});

describe('GET /organizations/:orgId/members', () => {
  it('returns owner after org creation', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}/members`,
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].userId).toBe(ownerCtx.userId);
    expect(body[0].role).toBe('owner');
    expect(body[0].user.email).toBe(ownerCtx.email);
  });

  it('returns 403 for non-member', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}/members`,
      headers: otherCtx.headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns 401 without session', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}/members`,
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /organizations/:orgId/members', () => {
  it('admin can add a member', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    // Owner is also admin-level, so can add members
    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/members`,
      payload: { email: otherCtx.email, role: 'member' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.userId).toBe(otherCtx.userId);
    expect(body.role).toBe('member');
    expect(body.user.email).toBe(otherCtx.email);
  });

  it('member cannot add members (403)', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    // Add otherCtx as a regular member
    await prisma.organizationMember.create({
      data: {
        userId: otherCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/members`,
      payload: { email: 'someone@example.com', role: 'member' },
      headers: otherCtx.headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for unknown email', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/members`,
      payload: { email: 'nonexistent@example.com', role: 'member' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 409 for duplicate member', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    await prisma.organizationMember.create({
      data: {
        userId: otherCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/members`,
      payload: { email: otherCtx.email, role: 'member' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(409);
  });

  it('rejects owner role in body', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/members`,
      payload: { email: otherCtx.email, role: 'owner' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('PATCH /organizations/:orgId/members/:id', () => {
  it('owner can update role', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const member = await prisma.organizationMember.create({
      data: {
        userId: otherCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });

    const response = await server.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}/members/${member.id}`,
      payload: { role: 'admin' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.role).toBe('admin');
  });

  it('admin cannot update roles (requires owner)', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    await prisma.organizationMember.create({
      data: {
        userId: otherCtx.userId,
        organizationId: org.id,
        role: 'admin',
      },
    });

    // Create a third user as member to try to update
    const thirdCtx = await createAuthenticatedUser(
      server,
      'members-third@example.com',
      'Password123!',
      'Third User',
    );
    const member = await prisma.organizationMember.create({
      data: {
        userId: thirdCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });

    const response = await server.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}/members/${member.id}`,
      payload: { role: 'admin' },
      headers: otherCtx.headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('cannot change owner role', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const ownerMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: ownerCtx.userId,
          organizationId: org.id,
        },
      },
    });

    const response = await server.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}/members/${ownerMembership!.id}`,
      payload: { role: 'admin' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for unknown member id', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'PATCH',
      url: `/organizations/${org.id}/members/00000000-0000-0000-0000-000000000000`,
      payload: { role: 'admin' },
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /organizations/:orgId/members/:id', () => {
  it('owner can remove a member', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const member = await prisma.organizationMember.create({
      data: {
        userId: otherCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}/members/${member.id}`,
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(204);

    const deleted = await prisma.organizationMember.findUnique({
      where: { id: member.id },
    });
    expect(deleted).toBeNull();
  });

  it('cannot remove the owner', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const ownerMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: ownerCtx.userId,
          organizationId: org.id,
        },
      },
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}/members/${ownerMembership!.id}`,
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('admin cannot remove members (requires owner)', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    await prisma.organizationMember.create({
      data: {
        userId: otherCtx.userId,
        organizationId: org.id,
        role: 'admin',
      },
    });

    const thirdCtx = await createAuthenticatedUser(
      server,
      'members-fourth@example.com',
      'Password123!',
      'Fourth User',
    );
    const member = await prisma.organizationMember.create({
      data: {
        userId: thirdCtx.userId,
        organizationId: org.id,
        role: 'member',
      },
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}/members/${member.id}`,
      headers: otherCtx.headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for unknown member id', async () => {
    const org = await createOrgWithOwner(ownerCtx.userId);
    const response = await server.inject({
      method: 'DELETE',
      url: `/organizations/${org.id}/members/00000000-0000-0000-0000-000000000000`,
      headers: ownerCtx.headers,
    });
    expect(response.statusCode).toBe(404);
  });
});
