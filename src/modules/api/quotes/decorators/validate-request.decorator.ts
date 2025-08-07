import { UsePipes } from '@nestjs/common';

import { ZodSchema } from 'zod';

import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/**
 * Decorator that validates request body using a Zod schema
 * @param schema The Zod schema to validate against
 * @returns Method decorator that applies ZodValidationPipe
 */
export const ValidateRequest = <T extends ZodSchema>(schema: T) => {
  return UsePipes(new ZodValidationPipe(schema));
};
