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
      protocol: z.enum(['http', 'grpc']).default('http'),
    })
    .default({}),

  // Jaeger exporter configuration (alternative to OTLP)
  jaeger: z
    .object({
      enabled: z.boolean().default(false),
      endpoint: z.string().default('http://localhost:14268/api/traces'),
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
    enabled: process.env.OPENTELEMETRY_ENABLED === 'true',
    serviceName: process.env.OPENTELEMETRY_SERVICE_NAME || 'blockchain-intent-solver',

    otlp: {
      endpoint: process.env.OPENTELEMETRY_OTLP_ENDPOINT || 'http://localhost:4318',
      headers: process.env.OPENTELEMETRY_OTLP_HEADERS
        ? JSON.parse(process.env.OPENTELEMETRY_OTLP_HEADERS)
        : {},
      protocol: (process.env.OPENTELEMETRY_OTLP_PROTOCOL || 'http') as 'http' | 'grpc',
    },

    jaeger: {
      enabled: process.env.OPENTELEMETRY_JAEGER_ENABLED === 'true',
      endpoint: process.env.OPENTELEMETRY_JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    },

    resource: {
      attributes: {
        'deployment.environment': process.env.NODE_ENV || 'development',
        ...(process.env.OPENTELEMETRY_RESOURCE_ATTRIBUTES
          ? JSON.parse(process.env.OPENTELEMETRY_RESOURCE_ATTRIBUTES)
          : {}),
      },
    },

    instrumentation: {
      http: {
        enabled: process.env.OPENTELEMETRY_INSTRUMENTATION_HTTP_ENABLED !== 'false',
        ignoreIncomingPaths: process.env.OPENTELEMETRY_INSTRUMENTATION_HTTP_IGNORE_PATHS
          ? process.env.OPENTELEMETRY_INSTRUMENTATION_HTTP_IGNORE_PATHS.split(',')
          : ['/health', '/health/live', '/health/ready'],
      },
      mongodb: {
        enabled: process.env.OPENTELEMETRY_INSTRUMENTATION_MONGODB_ENABLED !== 'false',
      },
      redis: {
        enabled: process.env.OPENTELEMETRY_INSTRUMENTATION_REDIS_ENABLED !== 'false',
      },
      nestjs: {
        enabled: process.env.OPENTELEMETRY_INSTRUMENTATION_NESTJS_ENABLED !== 'false',
      },
    },

    sampling: {
      ratio: process.env.OPENTELEMETRY_SAMPLING_RATIO
        ? parseFloat(process.env.OPENTELEMETRY_SAMPLING_RATIO)
        : 1.0,
    },
  };

  return OpenTelemetrySchema.parse(envVars);
});
