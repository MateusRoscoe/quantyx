import * as z from 'zod';

export const EventMessage = z.object({
  eventType: z.string().min(1),
});

export type EventMessage = z.infer<typeof EventMessage>;
