import { z } from 'zod';

import { ConfigSchema } from '@/config/config.schema';

/**
 * Helper class to access config schemas dynamically
 */
export class ConfigurationSchemas {
  // static readonly schema = ConfigSchema

  /**
   * Get a specific schema by key
   */
  static getSchema(key: string): z.ZodSchema | null {
    const schemaKey = key as keyof typeof ConfigSchema.shape;
    if (!(schemaKey in ConfigSchema.shape)) {
      return null;
    }
    return ConfigSchema.shape[schemaKey];
  }

  /**
   * Get all schema keys
   */
  static getSchemaKeys(): (keyof typeof ConfigSchema.shape)[] {
    return Object.keys(ConfigSchema.shape) as (keyof typeof ConfigSchema.shape)[];
  }

  /**
   * Check if a schema exists for a given key
   */
  static hasSchema(key: string): boolean {
    return key in ConfigSchema.shape;
  }
}
