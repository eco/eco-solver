import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class BigIntToStringInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => BigIntToStringInterceptor.transformBigInt(data)))
  }

  static transformBigInt(data: any): any {
    if (data === null || data === undefined) return data

    if (typeof data === 'bigint') {
      return data.toString()
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformBigInt(item))
    }

    if (this.isPlainObject(data)) {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, this.transformBigInt(value)]),
      )
    }

    return data
  }

  private static isPlainObject(obj: any): obj is Record<string, any> {
    return Object.prototype.toString.call(obj) === '[object Object]'
  }
}
