import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import {
  SEMATTRS_HTTP_HOST,
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_SCHEME,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_HTTP_TARGET,
  SEMATTRS_HTTP_URL,
  SEMATTRS_HTTP_USER_AGENT,
} from '@opentelemetry/semantic-conventions';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { OpenTelemetryService } from './opentelemetry.service';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(
    private readonly otelService: OpenTelemetryService,
    @Inject('OTEL_ENABLED') private readonly enabled: boolean,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const spanName = `${request.method} ${request.route?.path || request.url}`;

    return this.otelService.tracer.startActiveSpan(
      spanName,
      {
        kind: api.SpanKind.SERVER,
        attributes: {
          [SEMATTRS_HTTP_METHOD]: request.method,
          [SEMATTRS_HTTP_URL]: request.url,
          [SEMATTRS_HTTP_TARGET]: request.originalUrl,
          [SEMATTRS_HTTP_HOST]: request.headers.host,
          [SEMATTRS_HTTP_SCHEME]: request.protocol,
          [SEMATTRS_HTTP_USER_AGENT]: request.headers['user-agent'],
          'http.request_id': request.id,
          'controller.name': context.getClass().name,
          'handler.name': context.getHandler().name,
        },
      },
      (span) => {
        // Add custom attributes from request
        if (request.params && Object.keys(request.params).length > 0) {
          span.setAttribute('http.params', JSON.stringify(request.params));
        }

        return next.handle().pipe(
          tap({
            next: (data) => {
              // Add response attributes
              span.setAttributes({
                [SEMATTRS_HTTP_STATUS_CODE]: response.statusCode,
                'http.response.size': JSON.stringify(data)?.length,
              });

              // Set span status based on HTTP status code
              if (response.statusCode >= 400) {
                span.setStatus({
                  code: api.SpanStatusCode.ERROR,
                  message: `HTTP ${response.statusCode}`,
                });
              } else {
                span.setStatus({ code: api.SpanStatusCode.OK });
              }
            },
            error: (error) => {
              // Record exception and set error status
              span.recordException(error);
              span.setStatus({
                code: api.SpanStatusCode.ERROR,
                message: error.message,
              });

              // Add error attributes
              span.setAttributes({
                [SEMATTRS_HTTP_STATUS_CODE]: error.status || 500,
                'error.type': error.name,
                'error.message': error.message,
              });
            },
          }),
        );
      },
    );
  }
}
