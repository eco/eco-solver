import { DynamicConfigValidatorService } from '@/modules/dynamic-config/services/dynamic-config-validator.service';
import { Test, TestingModule } from '@nestjs/testing';
import { z } from 'zod';

describe('DynamicConfigValidatorService', () => {
  let service: DynamicConfigValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicConfigValidatorService],
    }).compile();

    service = module.get<DynamicConfigValidatorService>(DynamicConfigValidatorService);
  });

  describe('getSchema', () => {
    it('should return null for unregistered schema', () => {
      const retrieved = service.getSchema('nonexistent.key');
      expect(retrieved).toBeNull();
    });
  });

  describe('validateValue', () => {
    describe('string validation', () => {
      it('should validate string values', () => {
        const schema = z.string();
        const result = service.validateValue('test', schema);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid string types', () => {
        const schema = z.string();
        const result = service.validateValue(123, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should validate string with minimum length', () => {
        const schema = z.string().min(5);

        const validResult = service.validateValue('hello', schema);
        expect(validResult.isValid).toBe(true);

        const invalidResult = service.validateValue('hi', schema);
        expect(invalidResult.isValid).toBe(false);
      });
    });

    describe('number validation', () => {
      it('should validate number values', () => {
        const schema = z.number();
        const result = service.validateValue(123, schema);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid number types', () => {
        const schema = z.number();
        const result = service.validateValue('not-a-number', schema);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should validate number with minimum value', () => {
        const schema = z.number().min(10);

        const validResult = service.validateValue(15, schema);
        expect(validResult.isValid).toBe(true);

        const invalidResult = service.validateValue(5, schema);
        expect(invalidResult.isValid).toBe(false);
      });
    });

    describe('boolean validation', () => {
      it('should validate boolean values', () => {
        const schema = z.boolean();
        const result = service.validateValue(true, schema);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid boolean types', () => {
        const schema = z.boolean();
        const result = service.validateValue('not-a-boolean', schema);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('object validation', () => {
      it('should validate object values', () => {
        const schema = z.object({ key: z.string() });
        const obj = { key: 'value' };
        const result = service.validateValue(obj, schema);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid object structure', () => {
        const schema = z.object({ key: z.string() });
        const result = service.validateValue({ key: 123 }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('array validation', () => {
      it('should validate array values', () => {
        const schema = z.array(z.number());
        const arr = [1, 2, 3];
        const result = service.validateValue(arr, schema);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid array items', () => {
        const schema = z.array(z.number());
        const result = service.validateValue(['not', 'numbers'], schema);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('enum validation', () => {
      it('should validate enum values', () => {
        const schema = z.enum(['dev', 'staging', 'prod']);

        const validResult = service.validateValue('dev', schema);
        expect(validResult.isValid).toBe(true);

        const invalidResult = service.validateValue('invalid', schema);
        expect(invalidResult.isValid).toBe(false);
      });
    });
  });

  describe('additional validateValue tests', () => {
    it('should validate required values', () => {
      const schema = z.string();
      const result = service.validateValue('test', schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null for required values', () => {
      const schema = z.string();
      const result = service.validateValue(null, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow null for optional values', () => {
      const schema = z.string().optional();
      const result = service.validateValue(undefined, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('complex validation rules', () => {
      it('should validate string patterns', () => {
        const schema = z.string().regex(/^[a-z]+$/);

        const validResult = service.validateValue('hello', schema);
        expect(validResult.isValid).toBe(true);

        const invalidResult = service.validateValue('Hello123', schema);
        expect(invalidResult.isValid).toBe(false);
      });

      it('should validate array length constraints', () => {
        const schema = z.array(z.string()).min(2).max(3);

        const validResult = service.validateValue(['a', 'b'], schema);
        expect(validResult.isValid).toBe(true);

        const tooShortResult = service.validateValue(['a'], schema);
        expect(tooShortResult.isValid).toBe(false);

        const tooLongResult = service.validateValue(['a', 'b', 'c', 'd'], schema);
        expect(tooLongResult.isValid).toBe(false);
      });

      it('should validate nested object properties', () => {
        const schema = z.object({
          name: z.string().min(1),
          age: z.number().min(0),
          email: z.string().email().optional(),
        });

        const validResult = service.validateValue(
          {
            name: 'John',
            age: 25,
            email: 'john@example.com',
          },
          schema,
        );
        expect(validResult.isValid).toBe(true);

        const invalidResult = service.validateValue(
          {
            name: '',
            age: -5,
          },
          schema,
        );
        expect(invalidResult.isValid).toBe(false);
      });
    });
  });

  describe('validateConfiguration', () => {
    it('should validate with registered schema', async () => {
      const result = await service.validateConfiguration('port', 9494);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warning for unregistered schema', async () => {
      const result = await service.validateConfiguration('unknown.key', 'value');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain('No validation schema registered for key: unknown.key');
    });

    it('should validate with registered schema and return errors for invalid values', async () => {
      const result = await service.validateConfiguration('port', 'hi');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Validate Schemas', () => {
    it('should validate common schema patterns', async () => {
      // Test database validation
      const validDatabase = await service.validateConfiguration('mongodb', {
        uri: 'mongodb://localhost:27017',
      });
      expect(validDatabase.isValid).toBe(true);

      // Test AWS validation
      const validAws = await service.validateConfiguration('aws', {
        region: 'us-east-1',
        secretName: 'secret-1',
      });
      expect(validAws.isValid).toBe(true);
    });
  });
});
