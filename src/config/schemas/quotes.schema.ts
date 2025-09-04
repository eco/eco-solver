import { z } from 'zod';

/**
 * Registration configuration for the quotes service
 */
const RegistrationSchema = z.object({
  enabled: z.boolean().default(true).describe('Enable registration on startup'),
  baseUrl: z
    .string()
    .url()
    .describe('Base URL for registration service (e.g., https://api.example.com)'),
  apiUrl: z.string().url().optional().describe('Public endpoint URL for the quotes API'),
  privateKey: z.string().describe('Private key to generate the registration signature'),
});

/**
 * Quotes service configuration schema
 */
export const QuotesSchema = z.object({
  registration: RegistrationSchema,
});

export type QuotesConfig = z.infer<typeof QuotesSchema>;
export type RegistrationConfig = z.infer<typeof RegistrationSchema>;
