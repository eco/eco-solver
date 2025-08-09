import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

/**
 * Health check component status
 */
const HealthComponentSchema = z.object({
  status: z.enum(['up', 'down']),
  message: z.string().optional(),
});

/**
 * Health check details for each component
 */
const HealthDetailsSchema = z.object({
  mongodb: HealthComponentSchema.optional(),
  redis: HealthComponentSchema.optional(),
  blockchain: HealthComponentSchema.optional(),
});

/**
 * Successful health check response
 */
export const HealthSuccessResponseSchema = extendApi(
  z.object({
    status: z.literal('ok'),
    info: HealthDetailsSchema,
    error: z.object({}),
    details: HealthDetailsSchema,
  }),
  {
    description: 'Service is healthy',
    example: {
      status: 'ok',
      info: {
        mongodb: { status: 'up' },
        redis: { status: 'up' },
        blockchain: { status: 'up' },
      },
      error: {},
      details: {
        mongodb: { status: 'up' },
        redis: { status: 'up' },
        blockchain: { status: 'up' },
      },
    },
  },
);

/**
 * Failed health check response
 */
export const HealthErrorResponseSchema = extendApi(
  z.object({
    status: z.literal('error'),
    info: z.object({}),
    error: HealthDetailsSchema,
    details: z.object({}),
  }),
  {
    description: 'Service is unhealthy',
    example: {
      status: 'error',
      info: {},
      error: {
        mongodb: {
          status: 'down',
          message: 'Connection failed',
        },
      },
      details: {},
    },
  },
);

/**
 * Liveness check response
 */
export const LivenessResponseSchema = extendApi(
  z.object({
    status: z.literal('ok'),
    info: z.object({}),
    error: z.object({}),
    details: z.object({}),
  }),
  {
    description: 'Service is alive',
    example: {
      status: 'ok',
      info: {},
      error: {},
      details: {},
    },
  },
);

export type HealthSuccessResponse = z.infer<typeof HealthSuccessResponseSchema>;
export type HealthErrorResponse = z.infer<typeof HealthErrorResponseSchema>;
export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;
