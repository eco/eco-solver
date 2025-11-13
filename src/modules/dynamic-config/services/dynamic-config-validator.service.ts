import { Injectable, Logger } from '@nestjs/common';

import { z } from 'zod';

import { ConfigurationSchemas } from '@/modules/dynamic-config/schemas/configuration-schemas';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class DynamicConfigValidatorService {
  private readonly logger = new Logger(DynamicConfigValidatorService.name);
  private readonly schemas = new Map<string, z.ZodSchema>();

  /**
   * Get registered schema for a configuration key
   */
  getSchema(key: string): z.ZodSchema | null {
    return ConfigurationSchemas.getSchema(key);
  }

  /**
   * Validate a configuration value against its registered schema
   */
  async validateConfiguration(key: string, value: any): Promise<ValidationResult> {
    const schema = this.getSchema(key);

    if (!schema) {
      return {
        isValid: true,
        errors: [],
        warnings: [`No validation schema registered for key: ${key}`],
      };
    }

    return this.validateValue(value, schema);
  }

  /**
   * Validate a value against a Zod schema
   */
  validateValue(value: any, schema: z.ZodSchema): ValidationResult {
    const result = schema.safeParse(value);

    if (result.success) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } else {
      return {
        isValid: false,
        errors: [result.error.message],
        warnings: [],
      };
    }
  }
}
