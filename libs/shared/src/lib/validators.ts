import * as z from 'zod';
import { ISO3_CODES, CONTINENTS, REGIONS } from './country-data.js';

export const CountryCode = z
  .string()
  .refine((val) => ISO3_CODES.has(val), {
    message:
      'Invalid country code. Must be a valid ISO 3166-1 alpha-3 code (e.g., USA, GBR, BRA)',
  })
  .describe('ISO 3166-1 alpha-3 country code');

export type CountryCode = z.infer<typeof CountryCode>;

export const MAX_USER_AGENT_LENGTH = 1024;

// System event names for user/group identification
export const SYSTEM_EVENTS = {
  IDENTIFY: '$identify',
  SERVER_IDENTIFY: '$server_identify',
  GROUP_IDENTIFY: '$group_identify',
  SERVER_GROUP_IDENTIFY: '$server_group_identify',
  GROUP_ASSIGN: '$group_assign',
} as const;

// Reserved props_str keys used to carry group identity on system events
export const GROUP_IDENTITY_KEYS = {
  GROUP_TYPE: '$group_type',
  GROUP_ID: '$group_id',
} as const;

// Base object schema (used by EventMessage.extend and server-side schemas)
const EventMessageInputBase = z.object({
  // Core identifiers
  event_id: z.uuidv7(),
  session_id: z.uuidv7(),

  // User identifier, flexible as this is not generated internally by Quantyx
  // Empty string allowed for anonymous/unauthenticated events
  user_id: z.string().max(256),
  // Event name
  event_name: z.string().min(1).max(256),

  timestamp: z.iso.datetime({ precision: 3 }),

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

  // Optional client-provided overrides (only honored when ALLOW_CLIENT_IP_AND_UA is enabled)
  ip_address: z.ipv4().or(z.ipv6()).optional(),
  user_agent: z.string().max(MAX_USER_AGENT_LENGTH).optional(),
});

// Refinement for system event validation rules
function validateSystemEvents(
  data: z.infer<typeof EventMessageInputBase>,
  ctx: z.RefinementCtx,
) {
  const { event_name, user_id, props_str } = data;

  // Blanket reject any $server* event names from SDK/webhook ingestion
  if (event_name.startsWith('$server')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Event name "${event_name}" is reserved for server-side use`,
      path: ['event_name'],
    });
    return;
  }

  // $identify requires a non-empty user_id
  if (event_name === SYSTEM_EVENTS.IDENTIFY && !user_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '$identify requires a non-empty user_id',
      path: ['user_id'],
    });
  }

  // $group_identify requires $group_type and $group_id in props_str
  if (event_name === SYSTEM_EVENTS.GROUP_IDENTIFY) {
    if (!props_str?.[GROUP_IDENTITY_KEYS.GROUP_TYPE]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '$group_identify requires $group_type in props_str',
        path: ['props_str'],
      });
    }
    if (!props_str?.[GROUP_IDENTITY_KEYS.GROUP_ID]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '$group_identify requires $group_id in props_str',
        path: ['props_str'],
      });
    }
  }

  // $group_assign requires user_id + $group_type/$group_id in props_str
  if (event_name === SYSTEM_EVENTS.GROUP_ASSIGN) {
    if (!user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '$group_assign requires a non-empty user_id',
        path: ['user_id'],
      });
    }
    if (!props_str?.[GROUP_IDENTITY_KEYS.GROUP_TYPE]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '$group_assign requires $group_type in props_str',
        path: ['props_str'],
      });
    }
    if (!props_str?.[GROUP_IDENTITY_KEYS.GROUP_ID]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '$group_assign requires $group_id in props_str',
        path: ['props_str'],
      });
    }
  }
}

// Exported with refinements for webhook/SDK validation
export const EventMessageInput =
  EventMessageInputBase.superRefine(validateSystemEvents);

export const Continent = z.enum(CONTINENTS).describe('Continent name');

export type Continent = z.infer<typeof Continent>;

const Region = z.enum(REGIONS).describe('Geographical region');

export type Region = z.infer<typeof Region>;

export const EventMessage = EventMessageInputBase.extend({
  project_id: z.uuidv4(),
  ip_address: z.ipv4().or(z.ipv6()),
  continent: Continent.optional(),
  region: Region.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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

// --- API Keys ---
export const ApiKeyBody = z.object({
  name: z.string().min(1).max(256),
  expiresAt: z.string().datetime().optional(),
});

export const ApiKeyResponse = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ApiKeyCreatedResponse = ApiKeyResponse.extend({
  key: z.string(),
});

export type ApiKeyBody = z.infer<typeof ApiKeyBody>;
export type ApiKeyResponse = z.infer<typeof ApiKeyResponse>;
export type ApiKeyCreatedResponse = z.infer<typeof ApiKeyCreatedResponse>;

// --- Organization Members ---
export const MemberRole = z.enum(['owner', 'admin', 'member']);
export type MemberRole = z.infer<typeof MemberRole>;

export const AddMemberBody = z.object({
  email: z.string().email(),
  role: MemberRole.exclude(['owner']),
});

export const UpdateMemberRoleBody = z.object({
  role: MemberRole.exclude(['owner']),
});

export const MemberResponse = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: MemberRole,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

export type AddMemberBody = z.infer<typeof AddMemberBody>;
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBody>;
export type MemberResponse = z.infer<typeof MemberResponse>;

// --- Server-side Identification ---
const PropertiesFields = {
  props_str: z.record(z.string().max(256), z.string().max(256)).optional(),
  props_num: z.record(z.string().max(256), z.number()).optional(),
  props_bool: z.record(z.string().max(256), z.boolean()).optional(),
};

export const ServerIdentifyBody = z.object({
  userId: z.string().min(1).max(256),
  ...PropertiesFields,
});

export const ServerGroupIdentifyBody = z.object({
  groupType: z.string().min(1).max(256),
  groupId: z.string().min(1).max(256),
  ...PropertiesFields,
});

export const ServerGroupAssignBody = z.object({
  userId: z.string().min(1).max(256),
  groupType: z.string().min(1).max(256),
  groupId: z.string().min(1).max(256),
});

export type ServerIdentifyBody = z.infer<typeof ServerIdentifyBody>;
export type ServerGroupIdentifyBody = z.infer<typeof ServerGroupIdentifyBody>;
export type ServerGroupAssignBody = z.infer<typeof ServerGroupAssignBody>;
