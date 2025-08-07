import { ArgumentMetadata, BadRequestException } from '@nestjs/common';

import { z } from 'zod';

import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
    email: z.string().email().optional(),
  });

  let pipe: ZodValidationPipe<typeof testSchema>;
  let metadata: ArgumentMetadata;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
    metadata = {
      type: 'body',
      metatype: Object,
      data: '',
    };
  });

  describe('transform', () => {
    it('should pass valid data through unchanged', () => {
      const validData = {
        name: 'John Doe',
        age: 25,
        email: 'john@example.com',
      };

      const result = pipe.transform(validData, metadata);
      expect(result).toEqual(validData);
    });

    it('should pass valid data without optional fields', () => {
      const validData = {
        name: 'Jane Smith',
        age: 30,
      };

      const result = pipe.transform(validData, metadata);
      expect(result).toEqual(validData);
    });

    it('should throw BadRequestException for invalid data', () => {
      const invalidData = {
        name: '',
        age: -5,
        email: 'invalid-email',
      };

      expect(() => pipe.transform(invalidData, metadata)).toThrow(BadRequestException);
    });

    it('should format error messages correctly', () => {
      const invalidData = {
        name: '',
        age: -5,
      };

      try {
        pipe.transform(invalidData, metadata);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toEqual({
          message: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'name',
              message: expect.any(String),
            }),
            expect.objectContaining({
              path: 'age',
              message: expect.any(String),
            }),
          ]),
        });
      }
    });

    it('should handle nested validation errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      });

      const nestedPipe = new ZodValidationPipe(nestedSchema);
      const invalidData = {
        user: {
          profile: {
            name: '',
          },
        },
      };

      try {
        nestedPipe.transform(invalidData, metadata);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toEqual({
          message: 'Validation failed',
          errors: [
            {
              path: 'user.profile.name',
              message: expect.any(String),
            },
          ],
        });
      }
    });

    it('should rethrow non-ZodError errors', () => {
      const faultySchema = z.custom(() => {
        throw new Error('Custom error');
      });

      const faultyPipe = new ZodValidationPipe(faultySchema);

      expect(() => faultyPipe.transform({}, metadata)).toThrow('Custom error');
    });

    it('should transform data according to schema', () => {
      const transformSchema = z.object({
        number: z.string().transform((val) => parseInt(val, 10)),
        bigint: z.string().transform((val) => BigInt(val)),
      });

      const transformPipe = new ZodValidationPipe(transformSchema);
      const inputData = {
        number: '123',
        bigint: '999999999999999999',
      };

      const result = transformPipe.transform(inputData, metadata);
      expect(result).toEqual({
        number: 123,
        bigint: BigInt('999999999999999999'),
      });
    });
  });
});
