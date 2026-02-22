import * as z from 'zod';
import { countries } from 'country-code-lookup';

const codeSet = new Set(countries.map((c) => c.iso3));

export const CountryCode = z
  .string()
  .refine((val) => codeSet.has(val), {
    message:
      'Invalid country code. Must be a valid ISO 3166-1 alpha-3 code (e.g., USA, GBR, BRA)',
  })
  .describe('ISO 3166-1 alpha-3 country code');

export type CountryCode = z.infer<typeof CountryCode>;

export const EventMessageInput = z.object({
  // Core identifiers
  event_id: z.uuidv7(),
  tenant_id: z.uuidv4(),
  session_id: z.uuidv4(),

  // User identifier, flexible as this is not generated internally by Quantyx
  user_id: z.string().min(1).max(256),
  // Event name
  event_name: z.string().min(1).max(256),

  timestamp: z.iso.datetime({ precision: 3 }),
  date: z.iso.date().optional(),

  // Standard dimensions
  country: CountryCode.optional(),
  state: z
    .string()
    .max(256)
    .describe('State or province or local region')
    .optional(),
  city: z.string().max(256).optional(),
  device_type: z.string().max(256).optional(),
  platform: z.string().max(256).optional(),
  browser: z.string().max(256).optional(),
  browser_version: z.string().max(256).optional(),
  os: z.string().max(256).optional(),
  os_version: z.string().max(256).optional(),

  // Custom properties (flexible schema)
  props_str: z.record(z.string().max(256), z.string().max(256)).optional(),
  props_num: z.record(z.string().max(256), z.number()).optional(),
  props_bool: z.record(z.string().max(256), z.boolean()).optional(),
});

export const MAX_USER_AGENT_LENGTH = 1024;

const continentSet = new Set(countries.map((c) => c.continent));
export const Continent = z
  .enum(Array.from(continentSet))
  .describe('Continent name');

export type Continent = z.infer<typeof Continent>;

const regions = new Set(countries.map((c) => c.region));
const Region = z.enum(Array.from(regions)).describe('Geographical region');

export type Region = z.infer<typeof Region>;

export const EventMessage = EventMessageInput.extend({
  ip_address: z.ipv4().or(z.ipv6()),
  continent: Continent.optional(),
  region: Region.optional(),
  user_agent: z.string().max(MAX_USER_AGENT_LENGTH).optional(),
});

export type EventMessageInput = z.infer<typeof EventMessageInput>;
export type EventMessage = z.infer<typeof EventMessage>;

// --- Organizations ---
export const OrganizationBody = z.object({
  name: z.string().min(1).max(256),
});

export const OrganizationResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type OrganizationBody = z.infer<typeof OrganizationBody>;
export type OrganizationResponse = z.infer<typeof OrganizationResponse>;

// --- Projects ---
export const ProjectBody = z.object({
  name: z.string().min(1).max(256),
});

export const ProjectResponse = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProjectBody = z.infer<typeof ProjectBody>;
export type ProjectResponse = z.infer<typeof ProjectResponse>;
