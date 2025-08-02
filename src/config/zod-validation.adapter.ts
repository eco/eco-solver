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
        const errorMessages = error.errors
          .map((err) => {
            const path = err.path.join('.');
            return `${path}: ${err.message}`;
          })
          .join(', ');

        throw new Error(`Configuration validation error: ${errorMessages}`);
      }
      throw error;
    }
  };
}

/**
 * Transform environment variables for Zod validation
 * This function is a pass-through since the configuration factory
 * already handles the transformation to the proper nested structure
 */
export function transformEnvVarsForValidation(config: Record<string, any>): Record<string, any> {
  // The configuration factory already provides the proper nested structure
  // so we just return it as-is for validation
  return config;
}
