import { z } from 'zod';

/**
 * Route amount limit schema
 * Supports two formats:
 * 1. Simple number (acts as max limit) - backward compatible
 * 2. Object with optional min and max properties
 */
export const RouteAmountLimitSchema = z.union([
  z.coerce.number().int().positive(), // Backward compatible: acts as max
  z
    .object({
      min: z.coerce.number().int().positive().optional(),
      max: z.coerce.number().int().positive().optional(),
    })
    .refine(
      (data) => {
        // If both are defined, min must be <= max
        if (data.min !== undefined && data.max !== undefined) {
          return data.min <= data.max;
        }
        // At least one must be defined
        return data.min !== undefined || data.max !== undefined;
      },
      {
        message:
          'At least one of min or max must be defined, and min must be <= max when both are present',
      },
    ),
]);

export type RouteAmountLimit = z.infer<typeof RouteAmountLimitSchema>;
