import { ApiBody, ApiResponse } from '@nestjs/swagger';

import { generateSchema } from '@anatine/zod-openapi';
import { z } from 'zod';

/**
 * Converts Zod schema to OpenAPI schema with proper nested object handling
 */
function zodToOpenApiSchema(schema: z.ZodTypeAny) {
  try {
    // Use @anatine/zod-openapi's generateSchema
    const generated = generateSchema(schema);

    // Convert array types to single types and ensure proper structure
    const normalizeSchema = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      const normalized: any = {};

      // Handle type arrays - NestJS expects single type values
      if (obj.type && Array.isArray(obj.type)) {
        normalized.type = obj.type[0];
      } else if (obj.type) {
        normalized.type = obj.type;
      }

      // Copy other properties
      Object.keys(obj).forEach((key) => {
        if (key === 'type') return; // Already handled

        if (key === 'properties' && obj[key]) {
          // Recursively normalize properties
          normalized.properties = {};
          Object.keys(obj[key]).forEach((propKey) => {
            normalized.properties[propKey] = normalizeSchema(obj[key][propKey]);
          });
        } else if (key === 'items' && obj[key]) {
          // Recursively normalize array items
          normalized.items = normalizeSchema(obj[key]);
          if (!normalized.type) normalized.type = 'array';
        } else if (key === 'oneOf' && Array.isArray(obj[key])) {
          // Handle union types
          normalized.oneOf = obj[key].map(normalizeSchema);
        } else if ((key === 'allOf' || key === 'anyOf') && Array.isArray(obj[key])) {
          normalized[key] = obj[key].map(normalizeSchema);
        } else {
          // Copy other properties as-is
          normalized[key] = obj[key];
        }
      });

      // Ensure objects with properties have type
      if (normalized.properties && !normalized.type) {
        normalized.type = 'object';
      }

      return normalized;
    };

    const result = normalizeSchema(generated);

    // Remove transform functions and other Zod-specific properties
    const cleanSchema = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      const cleaned: any = {};
      Object.keys(obj).forEach((key) => {
        // Skip Zod internal properties
        if (key.startsWith('_') || key === 'transform') return;

        if (key === 'properties' && obj[key]) {
          cleaned.properties = {};
          Object.keys(obj[key]).forEach((propKey) => {
            cleaned.properties[propKey] = cleanSchema(obj[key][propKey]);
          });
        } else if (key === 'items' && obj[key]) {
          cleaned.items = cleanSchema(obj[key]);
        } else if (
          Array.isArray(obj[key]) &&
          (key === 'oneOf' || key === 'allOf' || key === 'anyOf')
        ) {
          cleaned[key] = obj[key].map(cleanSchema);
        } else {
          cleaned[key] = obj[key];
        }
      });
      return cleaned;
    };

    return cleanSchema(result);
  } catch (error) {
    console.error('Error generating OpenAPI schema from Zod:', error);
    // Fallback to a simple object schema
    return { type: 'object' };
  }
}

/**
 * Decorator to use Zod schema for Swagger API body documentation
 * @param schema - Zod schema to use for documentation
 * @param description - Optional description for the API body
 */
export function ApiZodBody(schema: z.ZodTypeAny, description?: string) {
  const openApiSchema = zodToOpenApiSchema(schema);

  return ApiBody({
    schema: openApiSchema,
    description,
  });
}

/**
 * Decorator to use Zod schema for Swagger API response documentation
 * @param status - HTTP status code
 * @param schema - Zod schema to use for documentation
 * @param description - Description of the response
 */
export function ApiZodResponse(status: number, schema: z.ZodTypeAny, description: string) {
  const openApiSchema = zodToOpenApiSchema(schema);

  return ApiResponse({
    status,
    schema: openApiSchema,
    description,
  });
}

/**
 * Helper to create multiple response decorators from Zod schemas
 * @param responses - Array of response configurations
 */
export function ApiZodResponses(
  responses: Array<{
    status: number;
    schema: z.ZodTypeAny;
    description: string;
  }>,
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    responses.forEach(({ status, schema, description }) => {
      const openApiSchema = zodToOpenApiSchema(schema);

      ApiResponse({
        status,
        schema: openApiSchema,
        description,
      })(target, propertyKey, descriptor);
    });
  };
}
