import { z } from 'zod';

import { createZodValidationAdapter } from '@/config/zod-validation.adapter';

describe('createZodValidationAdapter', () => {
  describe('successful validation', () => {
    it('should validate and return valid configuration', () => {
      const schema = z.object({
        port: z.number(),
        host: z.string(),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { port: 3000, host: 'localhost' };
      
      const result = validator(config);
      
      expect(result).toEqual(config);
    });

    it('should validate nested objects', () => {
      const schema = z.object({
        server: z.object({
          port: z.number(),
          host: z.string(),
        }),
        database: z.object({
          url: z.string().url(),
        }),
      });

      const validator = createZodValidationAdapter(schema);
      const config = {
        server: { port: 3000, host: 'localhost' },
        database: { url: 'postgresql://localhost:5432/db' },
      };
      
      const result = validator(config);
      
      expect(result).toEqual(config);
    });

    it('should apply default values from schema', () => {
      const schema = z.object({
        port: z.number().default(3000),
        env: z.enum(['development', 'production']).default('development'),
      });

      const validator = createZodValidationAdapter(schema);
      const config = {};
      
      const result = validator(config);
      
      expect(result).toEqual({
        port: 3000,
        env: 'development',
      });
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { required: 'value' };
      
      const result = validator(config);
      
      expect(result).toEqual({ required: 'value' });
    });
  });

  describe('validation errors', () => {
    it('should throw error for invalid types', () => {
      const schema = z.object({
        port: z.number(),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { port: 'not-a-number' };
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: port: Invalid input: expected number, received string'
      );
    });

    it('should throw error for missing required fields', () => {
      const schema = z.object({
        required: z.string(),
      });

      const validator = createZodValidationAdapter(schema);
      const config = {};
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: required: Invalid input: expected string, received undefined'
      );
    });

    it('should throw error for invalid enum values', () => {
      const schema = z.object({
        env: z.enum(['development', 'production']),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { env: 'invalid' };
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: env: Invalid option: expected one of "development"|"production"'
      );
    });

    it('should handle multiple validation errors', () => {
      const schema = z.object({
        port: z.number(),
        host: z.string(),
        database: z.object({
          url: z.string().url(),
        }),
      });

      const validator = createZodValidationAdapter(schema);
      const config = {
        port: 'invalid',
        // missing host
        database: { url: 'not-a-url' },
      };
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: port: Invalid input: expected number, received string, host: Invalid input: expected string, received undefined, database.url: Invalid URL'
      );
    });

    it('should handle deeply nested validation errors', () => {
      const schema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              value: z.number(),
            }),
          }),
        }),
      });

      const validator = createZodValidationAdapter(schema);
      const config = {
        level1: {
          level2: {
            level3: {
              value: 'not-a-number',
            },
          },
        },
      };
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: level1.level2.level3.value: Invalid input: expected number, received string'
      );
    });

    it('should handle regex validation errors', () => {
      const schema = z.object({
        privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { privateKey: 'invalid-key' };
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: privateKey: Invalid'
      );
    });

    it('should handle array validation errors', () => {
      const schema = z.object({
        ports: z.array(z.number()),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { ports: [3000, 'invalid', 5000] };
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: ports.1: Invalid input: expected number, received string'
      );
    });
  });

  describe('error handling', () => {
    it('should rethrow non-Zod errors', () => {
      const schema = z.object({
        value: z.string(),
      });

      const validator = createZodValidationAdapter(schema);
      
      // Mock schema.parse to throw a non-Zod error
      const originalParse = schema.parse;
      schema.parse = jest.fn().mockImplementation(() => {
        throw new Error('Some other error');
      });

      expect(() => validator({ value: 'test' })).toThrow('Some other error');

      // Restore original parse
      schema.parse = originalParse;
    });

    it('should handle empty error paths', () => {
      const schema = z.string();

      const validator = createZodValidationAdapter(schema);
      const config = 123 as any; // number instead of string
      
      expect(() => validator(config)).toThrow(
        'Configuration validation error: : Invalid input: expected string, received number'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle union types', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const validator = createZodValidationAdapter(schema);
      
      expect(validator({ value: 'string' })).toEqual({ value: 'string' });
      expect(validator({ value: 123 })).toEqual({ value: 123 });
    });

    it('should handle transform schemas', () => {
      const schema = z.object({
        port: z.string().transform((val) => parseInt(val, 10)),
      });

      const validator = createZodValidationAdapter(schema);
      const config = { port: '3000' };
      
      const result = validator(config);
      
      expect(result).toEqual({ port: 3000 });
    });

    it('should handle refine validations', () => {
      const schema = z.object({
        password: z.string(),
        confirmPassword: z.string(),
      }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
      });

      const validator = createZodValidationAdapter(schema);
      const config = { password: 'secret', confirmPassword: 'different' };
      
      expect(() => validator(config)).toThrow(
        "Configuration validation error: confirmPassword: Passwords don't match"
      );
    });
  });
});