import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

import { ZodError, ZodSchema, z } from 'zod';

@Injectable()
export class ZodValidationPipe<T extends ZodSchema> implements PipeTransform<z.input<T>, z.output<T>> {
  constructor(private schema: T) {}

  transform(value: z.input<T>, _metadata: ArgumentMetadata): z.output<T> {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }
      throw error;
    }
  }
}
