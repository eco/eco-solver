import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

/**
 * Common error response schema for API endpoints
 */
export const ErrorResponseSchema = extendApi(
  z.object({
    statusCode: z.number(),
    message: z.string(),
    error: z.string(),
    timestamp: z.string(),
    path: z.string(),
    requestId: z.string(),
  }),
  {
    description: 'Standard error response format',
  },
);

/**
 * Bad Request error response (400)
 */
export const BadRequestResponseSchema = extendApi(ErrorResponseSchema, {
  description: 'Invalid request format or validation errors',
  example: {
    statusCode: 400,
    message: 'Validation failed',
    error: 'Bad Request',
    timestamp: '2024-01-01T00:00:00.000Z',
    path: '/api/v1/quotes',
    requestId: 'req_123456',
  },
});
