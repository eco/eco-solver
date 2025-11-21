import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { QuotesConfig } from '@/config/schemas/quotes.schema';

@Injectable()
export class QuotesConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get the complete quotes configuration
   */
  get config(): QuotesConfig {
    return this.configService.get<QuotesConfig>('quotes')!;
  }

  /**
   * Check if quotes API is enabled
   */
  get isEnabled(): boolean {
    return this.configService.get<boolean>('quotes.enabled', true);
  }

  /**
   * Registration-specific getters for convenience
   */
  get registrationEnabled(): boolean {
    return this.configService.get<boolean>('quotes.registration.enabled', false);
  }

  get registrationBaseUrl(): string | undefined {
    return this.configService.get<string>('quotes.registration.baseUrl');
  }

  get registrationPrivateKey(): string | undefined {
    return this.configService.get<string>('quotes.registration.privateKey');
  }

  get apiUrl(): string {
    return this.configService.get<string>('quotes.registration.apiUrl')!;
  }
}
