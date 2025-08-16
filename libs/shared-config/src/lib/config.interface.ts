export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
    port: number;
    host: string;
  };
  
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableFile: boolean;
  };
  
  api: {
    prefix: string;
    version: string;
    cors: {
      enabled: boolean;
      origin: string | string[];
    };
  };
  
  security: {
    jwt: {
      secret: string;
      expirationTime: string;
    };
    bcrypt: {
      rounds: number;
    };
  };
}

export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: string;
  HOST: string;
  APP_NAME: string;
  APP_VERSION: string;
  
  DB_HOST: string;
  DB_PORT: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DB_SSL: string;
  
  LOG_LEVEL: string;
  LOG_CONSOLE: string;
  LOG_FILE: string;
  
  API_PREFIX: string;
  API_VERSION: string;
  CORS_ENABLED: string;
  CORS_ORIGIN: string;
  
  JWT_SECRET: string;
  JWT_EXPIRATION: string;
  BCRYPT_ROUNDS: string;
}