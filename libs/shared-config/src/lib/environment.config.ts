import { AppConfig, EnvironmentVariables } from './config.interface';

const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: 'eco-solver',
    version: '1.0.0',
    environment: 'development',
    port: 3000,
    host: 'localhost'
  },
  
  database: {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password',
    database: 'eco_solver',
    ssl: false
  },
  
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false
  },
  
  api: {
    prefix: '/api',
    version: 'v1',
    cors: {
      enabled: true,
      origin: ['http://localhost:3000', 'http://localhost:3001']
    }
  },
  
  security: {
    jwt: {
      secret: 'dev-secret-key',
      expirationTime: '1h'
    },
    bcrypt: {
      rounds: 10
    }
  }
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const ENVIRONMENT_CONFIGS: Record<string, DeepPartial<AppConfig>> = {
  development: {
    app: {
      environment: 'development',
      port: 3000
    },
    logging: {
      level: 'debug',
      enableConsole: true,
      enableFile: false
    },
    database: {
      ssl: false
    }
  },
  
  production: {
    app: {
      environment: 'production',
      port: 8080
    },
    logging: {
      level: 'warn',
      enableConsole: false,
      enableFile: true
    },
    database: {
      ssl: true
    },
    api: {
      cors: {
        enabled: true,
        origin: ['https://yourdomain.com']
      }
    }
  },
  
  test: {
    app: {
      environment: 'test',
      port: 3001
    },
    logging: {
      level: 'error',
      enableConsole: false,
      enableFile: false
    },
    database: {
      database: 'eco_solver_test'
    }
  }
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseStringArray = (value: string | undefined, defaultValue: string[]): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim());
};

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key], source[key] as DeepPartial<T[Extract<keyof T, string>]>);
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  
  return result;
}

export function createConfigFromEnvironment(): AppConfig {
  const env = process.env as unknown as EnvironmentVariables;
  const nodeEnv = env.NODE_ENV || 'development';
  
  const envConfig = ENVIRONMENT_CONFIGS[nodeEnv] || {};
  const baseConfig = deepMerge(DEFAULT_CONFIG, envConfig);
  
  const config: AppConfig = {
    app: {
      name: env.APP_NAME || baseConfig.app.name,
      version: env.APP_VERSION || baseConfig.app.version,
      environment: (nodeEnv as AppConfig['app']['environment']) || baseConfig.app.environment,
      port: parseNumber(env.PORT, baseConfig.app.port),
      host: env.HOST || baseConfig.app.host
    },
    
    database: {
      host: env.DB_HOST || baseConfig.database.host,
      port: parseNumber(env.DB_PORT, baseConfig.database.port),
      username: env.DB_USERNAME || baseConfig.database.username,
      password: env.DB_PASSWORD || baseConfig.database.password,
      database: env.DB_DATABASE || baseConfig.database.database,
      ssl: parseBoolean(env.DB_SSL, baseConfig.database.ssl)
    },
    
    logging: {
      level: (env.LOG_LEVEL as AppConfig['logging']['level']) || baseConfig.logging.level,
      enableConsole: parseBoolean(env.LOG_CONSOLE, baseConfig.logging.enableConsole),
      enableFile: parseBoolean(env.LOG_FILE, baseConfig.logging.enableFile)
    },
    
    api: {
      prefix: env.API_PREFIX || baseConfig.api.prefix,
      version: env.API_VERSION || baseConfig.api.version,
      cors: {
        enabled: parseBoolean(env.CORS_ENABLED, baseConfig.api.cors.enabled),
        origin: env.CORS_ORIGIN ? parseStringArray(env.CORS_ORIGIN, []) : baseConfig.api.cors.origin
      }
    },
    
    security: {
      jwt: {
        secret: env.JWT_SECRET || (() => {
          if (nodeEnv === 'production') {
            throw new Error('JWT_SECRET environment variable is required in production');
          }
          return baseConfig.security.jwt.secret;
        })(),
        expirationTime: env.JWT_EXPIRATION || baseConfig.security.jwt.expirationTime
      },
      bcrypt: {
        rounds: parseNumber(env.BCRYPT_ROUNDS, baseConfig.security.bcrypt.rounds)
      }
    }
  };
  
  return config;
}