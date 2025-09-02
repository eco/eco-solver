import * as winston from 'winston';

import { AppConfigService } from '@/modules/config/services/app-config.service';
import { LogData, LogObject } from '@/modules/logging/types/log-data.type';

export function createWinstonConfig(
  appConfig: AppConfigService,
  transports: winston.transport[],
): winston.LoggerOptions {
  const logLevel = appConfig.env === 'production' ? 'info' : 'debug';

  return {
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    defaultMeta: {
      service: 'blockchain-intent-solver',
      environment: appConfig.env,
    },
    transports,
    exitOnError: false,
  };
}

export function maskSensitiveData(data: LogData): LogData {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'key',
    'privateKey',
    'private_key',
    'api_key',
    'apiKey',
    'authorization',
    'auth',
  ];

  const masked = { ...(data as LogObject) };

  Object.keys(masked).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  });

  return masked;
}
