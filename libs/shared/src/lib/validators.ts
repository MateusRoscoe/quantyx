import * as z from 'zod';

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
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  // Standard dimensions
  country: z.string().max(256).optional(),
  region: z.string().max(256).optional(),
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

export const EventMessage = EventMessageInput.extend({
  ip_address: z.ipv4().or(z.ipv6()),
  user_agent: z.string().max(MAX_USER_AGENT_LENGTH).optional(),
});

export type EventMessageInput = z.infer<typeof EventMessageInput>;
export type EventMessage = z.infer<typeof EventMessage>;
