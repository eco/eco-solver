import { Injectable } from '@nestjs/common';
import { AppConfig } from './config.interface';
import { createConfigFromEnvironment } from './environment.config';

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;
  
  constructor() {
    this.config = createConfigFromEnvironment();
    this.validateConfig();
  }
  
  get(): AppConfig;
  get<T = any>(path: string): T;
  get<T = any>(path?: string): T | AppConfig {
    if (path) {
      return this.getNestedValue(this.config, path);
    }
    return this.config;
  }
  
  getApp() {
    return this.config.app;
  }
  
  getDatabase() {
    return this.config.database;
  }
  
  getLogging() {
    return this.config.logging;
  }
  
  getApi() {
    return this.config.api;
  }
  
  getSecurity() {
    return this.config.security;
  }
  
  isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }
  
  isProduction(): boolean {
    return this.config.app.environment === 'production';
  }
  
  isTest(): boolean {
    return this.config.app.environment === 'test';
  }
  
  getEnvironment(): string {
    return this.config.app.environment;
  }
  
  private validateConfig(): void {
    const errors: string[] = [];
    
    if (!this.config.app.name) {
      errors.push('App name is required');
    }
    
    if (this.config.app.port < 1 || this.config.app.port > 65535) {
      errors.push('App port must be between 1 and 65535');
    }
    
    if (!this.config.database.host) {
      errors.push('Database host is required');
    }
    
    if (!this.config.database.database) {
      errors.push('Database name is required');
    }
    
    if (this.isProduction()) {
      if (this.config.security.jwt.secret === 'dev-secret-key') {
        errors.push('JWT secret must be changed in production');
      }
      
      if (!this.config.database.password) {
        errors.push('Database password is required in production');
      }
      
      if (Array.isArray(this.config.api.cors.origin) && this.config.api.cors.origin.includes('*')) {
        errors.push('CORS origin cannot include wildcard (*) in production');
      } else if (this.config.api.cors.origin === '*') {
        errors.push('CORS origin cannot be wildcard (*) in production');
      }
      
      if (!this.config.database.ssl) {
        errors.push('Database SSL must be enabled in production');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

export function createConfigService(): ConfigService {
  return new ConfigService();
}

export const ConfigServiceProvider = {
  provide: ConfigService,
  useFactory: createConfigService,
};