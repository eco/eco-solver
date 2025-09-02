import { Injectable, NestMiddleware } from '@nestjs/common';

import { NextFunction, Request, Response } from 'express';

import { BullBoardConfigService } from '@/modules/config/services/bull-board-config.service';

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
  constructor(private readonly bullBoardConfig: BullBoardConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Only apply auth if required (production with credentials)
    if (!this.bullBoardConfig.requiresAuth) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return this.sendUnauthorized(res);
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    const validUsername = this.bullBoardConfig.username;
    const validPassword = this.bullBoardConfig.password;

    if (!validUsername || !validPassword) {
      // If credentials are not configured in production, deny access
      return this.sendUnauthorized(res);
    }

    if (username === validUsername && password === validPassword) {
      return next();
    }

    return this.sendUnauthorized(res);
  }

  private sendUnauthorized(res: Response) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Admin"');
    res.status(401).send('Authentication required');
  }
}