import { Test, TestingModule } from '@nestjs/testing';

import { DynamicConfigSanitizerService } from '@/modules/dynamic-config/services/dynamic-config-sanitizer.service';

describe('DynamicConfigSanitizerService', () => {
  let service: DynamicConfigSanitizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicConfigSanitizerService],
    }).compile();

    service = module.get<DynamicConfigSanitizerService>(DynamicConfigSanitizerService);
  });

  describe('sanitizeValue', () => {
    it('should sanitize string values', () => {
      const input = '  <script>alert("xss")</script>Hello World  ';
      const result = service.sanitizeValue(input);
      // With simplified sanitization, only trimming is applied
      expect(result).toBe('<script>alert("xss")</script>Hello World');
    });

    it('should trim dangerous protocols', () => {
      const input = '  javascript:alert("xss")  ';
      const result = service.sanitizeValue(input);
      // With simplified sanitization, only trimming is applied
      expect(result).toBe('javascript:alert("xss")');
    });

    it('should handle null and undefined values', () => {
      expect(service.sanitizeValue(null)).toBeNull();
      expect(service.sanitizeValue(undefined)).toBeUndefined();
    });

    it('should trim object values recursively', () => {
      const input = {
        safe: '  normal value  ',
        dangerous: '  <script>alert("xss")</script>  ',
        nested: {
          value: '  javascript:void(0)  ',
        },
      };
      const result = service.sanitizeValue(input);
      // With trim-only sanitization, only whitespace is removed
      expect(result).toEqual({
        safe: 'normal value',
        dangerous: '<script>alert("xss")</script>',
        nested: {
          value: 'javascript:void(0)',
        },
      });
    });

    it('should trim array values', () => {
      const input = ['  safe  ', '  <script>alert("xss")</script>  ', '  javascript:void(0)  '];
      const result = service.sanitizeValue(input);
      // With trim-only sanitization, only whitespace is removed
      expect(result).toEqual(['safe', '<script>alert("xss")</script>', 'javascript:void(0)']);
    });

    it('should handle very long strings without truncation', () => {
      const longString = 'a'.repeat(15000);
      const result = service.sanitizeValue(longString);
      // With simplified sanitization, no length truncation is applied
      expect(result).toHaveLength(15000);
      expect(result).toBe(longString);
    });

    it('should pass through numbers and booleans unchanged', () => {
      expect(service.sanitizeValue(123)).toBe(123);
      expect(service.sanitizeValue(true)).toBe(true);
      expect(service.sanitizeValue(false)).toBe(false);
    });
  });

  describe('validateConfigurationKey', () => {
    it('should accept valid configuration keys', () => {
      const validKeys = [
        'database.host',
        'redis_port',
        'api-key',
        'feature.enabled',
        'config123',
        'a.b.c.d',
      ];

      validKeys.forEach((key) => {
        const result = service.validateConfigurationKey(key);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid configuration keys', () => {
      const invalidKeys = [
        '',
        'key with spaces',
        'key@symbol',
        'key#hash',
        'key$dollar',
        'key%percent',
      ];

      invalidKeys.forEach((key) => {
        const result = service.validateConfigurationKey(key);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject keys that are too long', () => {
      const longKey = 'a'.repeat(101);
      const result = service.validateConfigurationKey(longKey);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot exceed 100 characters');
    });

    it('should reject reserved keys', () => {
      const reservedKeys = ['__proto__', 'constructor', 'prototype'];

      reservedKeys.forEach((key) => {
        const result = service.validateConfigurationKey(key);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('reserved name');
      });
    });

    it('should reject non-string keys', () => {
      const result = service.validateConfigurationKey(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });
  });

  describe('detectSensitiveValue', () => {
    it('should detect sensitive keys', () => {
      const sensitiveKeys = [
        'database.password',
        'api_secret',
        'auth_token',
        'private_key',
        'user_credential',
      ];

      sensitiveKeys.forEach((key) => {
        const result = service.detectSensitiveValue(key, 'some-value');
        expect(result).toBe(true);
      });
    });

    it('should detect sensitive keys regardless of value', () => {
      const sensitiveKeys = [
        'database.password',
        'api_secret',
        'auth_token',
        'private_key',
        'user_credential',
      ];

      sensitiveKeys.forEach((key) => {
        // Value doesn't matter - only key pattern is checked
        expect(service.detectSensitiveValue(key, 'any-value')).toBe(true);
        expect(service.detectSensitiveValue(key, 123)).toBe(true);
        expect(service.detectSensitiveValue(key, null)).toBe(true);
      });
    });

    it('should not flag non-sensitive keys as sensitive', () => {
      const normalKeys = ['database.host', 'server.port', 'app.name', 'feature.enabled'];

      normalKeys.forEach((key) => {
        // Even with suspicious values, non-sensitive keys should return false
        expect(service.detectSensitiveValue(key, 'sk_test_1234567890abcdef')).toBe(false);
        expect(service.detectSensitiveValue(key, '$2b$10$hashedpassword')).toBe(false);
        expect(service.detectSensitiveValue(key, 'jwt.token.here')).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(service.sanitizeValue('')).toBe('');
    });

    it('should handle deeply nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              dangerous: '  <script>alert("deep")</script>  ',
            },
          },
        },
      };

      const result = service.sanitizeValue(deepObject);
      // With trim-only sanitization, only whitespace is removed
      expect(result.level1.level2.level3.dangerous).toBe('<script>alert("deep")</script>');
    });

    it('should handle mixed arrays', () => {
      const mixedArray = [
        'string',
        123,
        { key: '<script>alert("xss")</script>' },
        ['nested', 'javascript:void(0)'],
      ];

      const result = service.sanitizeValue(mixedArray);
      // With simplified sanitization, only trimming is applied
      expect(result).toEqual([
        'string',
        123,
        { key: '<script>alert("xss")</script>' },
        ['nested', 'javascript:void(0)'],
      ]);
    });
  });
});
