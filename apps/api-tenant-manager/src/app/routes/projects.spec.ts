import Fastify, { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { prisma } from '@quantyx/postgres';
import { app } from '../app';

let server: FastifyInstance;

beforeAll(async () => {
  server = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(app);
  await server.ready();
});

beforeEach(async () => {
  // Deleting organizations cascades to projects
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await server.close();
  await prisma.$disconnect();
});

async function createOrg(name = 'Test Org') {
  return prisma.organization.create({ data: { name } });
}

describe('GET /organizations/:orgId/projects', () => {
  it('returns empty list when no projects exist', async () => {
    const org = await createOrg();
    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}/projects`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('lists only projects belonging to the specified org', async () => {
    const org1 = await createOrg('Org 1');
    const org2 = await createOrg('Org 2');
    const project = await prisma.project.create({
      data: { name: 'Proj A', organizationId: org1.id },
    });
    await prisma.project.create({
      data: { name: 'Proj B', organizationId: org2.id },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org1.id}/projects`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(project.id);
  });

  it('excludes soft-deleted projects', async () => {
    const org = await createOrg();
    const visible = await prisma.project.create({
      data: { name: 'Visible', organizationId: org.id },
    });
    await prisma.project.create({
      data: { name: 'Hidden', organizationId: org.id, deletedAt: new Date() },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/organizations/${org.id}/projects`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(visible.id);
  });
});

describe('POST /organizations/:orgId/projects', () => {
  it('creates a project and returns 201', async () => {
    const org = await createOrg();
    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/projects`,
      payload: { name: 'My Project' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeDefined();
    expect(body.organizationId).toBe(org.id);
    expect(body.name).toBe('My Project');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('returns 404 for unknown orgId', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/organizations/00000000-0000-0000-0000-000000000000/projects',
      payload: { name: 'Ghost Project' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 400 for missing name', async () => {
    const org = await createOrg();
    const response = await server.inject({
      method: 'POST',
      url: `/organizations/${org.id}/projects`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /projects/:id', () => {
  it('returns the project by id', async () => {
    const org = await createOrg();
    const project = await prisma.project.create({
      data: { name: 'Alpha', organizationId: org.id },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/projects/${project.id}`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(project.id);
    expect(body.organizationId).toBe(org.id);
    expect(body.name).toBe('Alpha');
  });

  it('returns 404 for unknown UUID', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/projects/00000000-0000-0000-0000-000000000000',
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 for a soft-deleted project', async () => {
    const org = await createOrg();
    const project = await prisma.project.create({
      data: { name: 'Deleted', organizationId: org.id, deletedAt: new Date() },
    });

    const response = await server.inject({
      method: 'GET',
      url: `/projects/${project.id}`,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /projects/:id', () => {
  it('updates the project name and returns 200', async () => {
    const org = await createOrg();
    const project = await prisma.project.create({
      data: { name: 'Old Name', organizationId: org.id },
    });

    const response = await server.inject({
      method: 'PATCH',
      url: `/projects/${project.id}`,
      payload: { name: 'New Name' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('New Name');
  });

  it('returns 404 for unknown UUID', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: '/projects/00000000-0000-0000-0000-000000000000',
      payload: { name: 'Anything' },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /projects/:id', () => {
  it('soft deletes and returns 204, record remains with deletedAt set', async () => {
    const org = await createOrg();
    const project = await prisma.project.create({
      data: { name: 'ToDelete', organizationId: org.id },
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/projects/${project.id}`,
    });
    expect(response.statusCode).toBe(204);

    const record = await prisma.project.findUnique({ where: { id: project.id } });
    expect(record).not.toBeNull();
    expect(record!.deletedAt).not.toBeNull();
  });

  it('returns 404 for unknown UUID', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/projects/00000000-0000-0000-0000-000000000000',
    });
    expect(response.statusCode).toBe(404);
  });
});
