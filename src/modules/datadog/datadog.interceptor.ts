import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { DataDogService } from './datadog.service';

@Injectable()
export class DataDogInterceptor implements NestInterceptor {
  constructor(private readonly dataDogService: DataDogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    // Skip metrics for health check endpoints
    if (
      request.path === '/health' ||
      request.path === '/health/live' ||
      request.path === '/health/ready'
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const method = request.method;
        const route = request.route?.path || request.path;
        const statusCode = response.statusCode;

        // Record HTTP metrics
        this.dataDogService.recordHttpRequest(method, route, statusCode, duration);
      }),
    );
  }
}
