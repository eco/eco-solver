import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
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
    const requestId = req.headers['x-request-id'] as string || randomUUID();
    
    // Attach to request object
    req.id = requestId;
    
    // Add to response headers
    res.setHeader('X-Request-Id', requestId);
    
    next();
  }
}