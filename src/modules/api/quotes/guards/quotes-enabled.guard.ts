import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

import { QuotesConfigService } from '@/modules/config/services/quotes-config.service';

/**
 * Guard that checks if the quotes API is enabled via configuration.
 * Throws NotFoundException if quotes are disabled, making the endpoint return 404.
 */
@Injectable()
export class QuotesEnabledGuard implements CanActivate {
  constructor(private readonly quotesConfig: QuotesConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.quotesConfig.isEnabled) {
      throw new NotFoundException('Quotes API is disabled');
    }
    return true;
  }
}
