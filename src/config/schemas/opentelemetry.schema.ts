import { registerAs } from '@nestjs/config';

import { z } from 'zod';

/**
 * OpenTelemetry configuration schema
 */
export const OpenTelemetrySchema = z.object({
  enabled: z.boolean().default(false),
  serviceName: z.string().default('blockchain-intent-solver'),

  // OTLP exporter configuration
  otlp: z
    .object({
      endpoint: z.string().default('http://localhost:4318'),
      headers: z.record(z.string()).default({}),
    })
    .default({}),

  // Resource attributes
  resource: z
    .object({
      attributes: z.record(z.string()).default({
        'deployment.environment': 'development',
      }),
    })
    .default({}),

  // Instrumentation configuration
  instrumentation: z
    .object({
      http: z
        .object({
          enabled: z.boolean().default(true),
          ignoreIncomingPaths: z
            .array(z.string())
            .default(['/health', '/health/live', '/health/ready']),
        })
        .default({}),
      mongodb: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({}),
      redis: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({}),
      nestjs: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),

  // Sampling configuration
  sampling: z
    .object({
      // Sampling rate (0.0 to 1.0)
      ratio: z.number().min(0).max(1).default(1.0),
    })
    .default({}),
});

export type OpenTelemetryConfig = z.infer<typeof OpenTelemetrySchema>;

/**
 * OpenTelemetry configuration factory for NestJS
 */
export const openTelemetryConfig = registerAs('opentelemetry', () => {
  const envVars = {
    enabled: true,
    serviceName: 'blockchain-intent-solver',

    otlp: {
      endpoint: 'http://localhost:4318',
      protocol: 'http',
    },

    resource: {
      attributes: {
        'deployment.environment': 'development',
      },
    },

    instrumentation: {
      http: {
        enabled: true,
        ignoreIncomingPaths: ['/health', '/health/live', '/health/ready'],
      },
      mongodb: {
        enabled: true,
      },
      redis: {
        enabled: true,
      },
      nestjs: {
        enabled: true,
      },
    },

    sampling: {
      ratio: 1.0,
    },
  };

  return OpenTelemetrySchema.parse(envVars);
});
