import { z } from 'zod';

/**
 * Pino redact configuration schema
 */
const PinoRedactSchema = z
  .object({
    paths: z
      .array(z.string())
      .default([
        'req.headers.authorization',
        'req.headers.accept',
        'req.headers["cache-control"]',
        'req.headers["accept-encoding"]',
        'req.headers["content-type"]',
        'req.headers["content-length"]',
        'req.headers.connection',
        'res.headers',
        'err.stack',
      ]),
    remove: z.boolean().default(true),
  })
  .default({
    paths: [
      'req.headers.authorization',
      'req.headers.accept',
      'req.headers["cache-control"]',
      'req.headers["accept-encoding"]',
      'req.headers["content-type"]',
      'req.headers["content-length"]',
      'req.headers.connection',
      'res.headers',
      'err.stack',
    ],
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
      paths: [
        'req.headers.authorization',
        'req.headers.accept',
        'req.headers["cache-control"]',
        'req.headers["accept-encoding"]',
        'req.headers["content-type"]',
        'req.headers["content-length"]',
        'req.headers.connection',
        'res.headers',
        'err.stack',
      ],
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
        paths: [
          'req.headers.authorization',
          'req.headers.accept',
          'req.headers["cache-control"]',
          'req.headers["accept-encoding"]',
          'req.headers["content-type"]',
          'req.headers["content-length"]',
          'req.headers.connection',
          'res.headers',
          'err.stack',
        ],
        remove: true,
      },
    },
  });

/**
 * Logger configuration schema
 */
export const LoggerSchema = z
  .object({
    usePino: z.boolean().default(true),
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
  })
  .default({
    usePino: true,
    pinoConfig: {
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        useLevelLabels: true,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.accept',
            'req.headers["cache-control"]',
            'req.headers["accept-encoding"]',
            'req.headers["content-type"]',
            'req.headers["content-length"]',
            'req.headers.connection',
            'res.headers',
            'err.stack',
          ],
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
  });

export type LoggerConfig = z.infer<typeof LoggerSchema>;
