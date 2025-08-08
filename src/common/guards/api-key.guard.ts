import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { Request } from 'express';

import { AppConfigService } from '@/modules/config/services/app-config.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const validApiKeys = this.appConfig.apiKeys;
    if (!validApiKeys || validApiKeys.length === 0) {
      // If no API keys are configured, allow access (for development)
      return true;
    }

    if (!validApiKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Check header first
    const headerKey = request.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    // Check query parameter as fallback
    return request.query['api_key'] as string;
  }
}
