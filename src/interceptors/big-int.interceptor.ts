import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class BigIntToStringInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transformBigInt(data)))
  }

  private transformBigInt(data: any): any {
    if (data === null || data === undefined) return data

    if (typeof data === 'bigint') {
      return data.toString()
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformBigInt(item))
    }

    if (typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, this.transformBigInt(value)]),
      )
    }

    return data
  }
}
