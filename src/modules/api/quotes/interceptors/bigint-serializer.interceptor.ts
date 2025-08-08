import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SerializableObject
  | SerializableValue[];
type SerializableObject = { [key: string]: SerializableValue };

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor<any, SerializableValue> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<SerializableValue> {
    return next.handle().pipe(map((data) => this.transformBigInt(data)));
  }

  private transformBigInt(value: any): SerializableValue {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transformBigInt(item));
    }

    if (typeof value === 'object') {
      const transformed: SerializableObject = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          transformed[key] = this.transformBigInt(value[key]);
        }
      }
      return transformed;
    }

    return value;
  }
}
