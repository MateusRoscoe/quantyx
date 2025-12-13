import { z } from 'zod';

export const ErrorResponseSchema = z
  .object({
    statusCode: z.number().int().describe('HTTP status code'),
    error: z.string().describe('Error name (e.g., Bad Request)'),
    message: z.string().describe('Detailed error message from validation'),
    validation: z
      .array(z.any())
      .optional()
      .describe('Details of validation failures'),
  })
  .describe('Standard API Error Response');
