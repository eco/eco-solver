import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MetricsRegistryService } from './metrics-registry.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsRegistry: MetricsRegistryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Skip health check endpoints
    const path = request.path;
    if (path === '/health' || path === '/health/live' || path === '/health/ready') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const method = request.method;
        const route = request.route?.path || request.path;
        const statusCode = response.statusCode;

        this.metricsRegistry.recordHttpRequest(method, route, statusCode, duration);
      }),
    );
  }
}
