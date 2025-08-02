import { z } from 'zod';

/**
 * Adapter to make Zod work with NestJS ConfigModule validation
 * NestJS expects a validation function that throws errors in a specific format
 */
export function createZodValidationAdapter(schema: z.ZodSchema) {
  return (config: Record<string, any>) => {
    try {
      // Parse and validate the configuration
      const validated = schema.parse(config);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Convert Zod errors to a format similar to Joi
        const errorMessages = error.issues
          .map((issue) => {
            const path = issue.path.join('.');
            return `${path}: ${issue.message}`;
          })
          .join(', ');

        throw new Error(`Configuration validation error: ${errorMessages}`);
      }
      throw error;
    }
  };
}
