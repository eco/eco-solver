import { randomUUID } from 'crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';

import { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if request already has an ID from headers
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Attach to request object
    req.id = requestId;

    // Add to response headers
    res.setHeader('X-Request-Id', requestId);

    // Log request completion
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'HTTP Request',
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        }),
      );
    });

    next();
  }
}
