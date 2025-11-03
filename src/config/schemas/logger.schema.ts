import { z } from 'zod';

/**
 * Default redaction paths for sensitive data
 */
const DEFAULT_REDACT_PATHS = [
  // Authentication and authorization headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  // API key headers (common patterns)
  'req.headers["x-api-key"]',
  'req.headers["api-key"]',
  'req.headers["apikey"]',
  // Error stack traces for privacy
  'err.stack',
] as const;

/**
 * Pino redact configuration schema
 */
const PinoRedactSchema = z
  .object({
    paths: z.array(z.string()).default([...DEFAULT_REDACT_PATHS]),
    remove: z.boolean().default(true),
  })
  .default({
    paths: [...DEFAULT_REDACT_PATHS],
    remove: true,
  });

/**
 * Pino HTTP configuration schema
 */
const PinoHttpSchema = z
  .object({
    level: z.string().default(process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    useLevelLabels: z.boolean().default(true),
    redact: PinoRedactSchema,
  })
  .default({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    useLevelLabels: true,
    redact: {
      paths: [...DEFAULT_REDACT_PATHS],
      remove: true,
    },
  });

/**
 * Pino configuration schema
 */
const PinoConfigSchema = z
  .object({
    pinoHttp: PinoHttpSchema,
  })
  .default({
    pinoHttp: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      useLevelLabels: true,
      redact: {
        paths: [...DEFAULT_REDACT_PATHS],
        remove: true,
      },
    },
  });

/**
 * OpenTelemetry log export configuration schema
 */
const OtelLogExportSchema = z
  .object({
    enabled: z.boolean().default(false),
    endpoint: z.string().optional(), // If not provided, uses OpenTelemetry OTLP endpoint
    headers: z.record(z.string()).default({}),
  })
  .optional();

/**
 * Logger configuration schema
 */
export const LoggerSchema = z
  .object({
    usePino: z.boolean().default(true),
    pretty: z.boolean().default(process.env.NODE_ENV !== 'production'),
    pinoConfig: PinoConfigSchema,
    maskKeywords: z
      .array(z.string())
      .default([
        'password',
        'secret',
        'token',
        'key',
        'privateKey',
        'api_key',
        'authorization',
        'auth',
      ]),
    otelLogExport: OtelLogExportSchema,
  })
  .default({
    usePino: true,
    pretty: process.env.NODE_ENV !== 'production',
    pinoConfig: {
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        useLevelLabels: true,
        redact: {
          paths: [...DEFAULT_REDACT_PATHS],
          remove: true,
        },
      },
    },
    maskKeywords: [
      'password',
      'secret',
      'token',
      'key',
      'privateKey',
      'api_key',
      'authorization',
      'auth',
    ],
    otelLogExport: {
      enabled: false,
      headers: {},
    },
  });

export type LoggerConfig = z.infer<typeof LoggerSchema>;
