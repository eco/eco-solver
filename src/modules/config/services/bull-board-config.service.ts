import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BullBoardConfig } from '@/config/schemas';
import { AppConfigService } from '@/modules/config/services/app-config.service';

@Injectable()
export class BullBoardConfigService {
  constructor(
    private configService: ConfigService,
    private appConfigService: AppConfigService,
  ) {}

  get username(): BullBoardConfig['username'] {
    return this.configService.get<string>('bullBoard.username');
  }

  get password(): BullBoardConfig['password'] {
    return this.configService.get<string>('bullBoard.password');
  }

  get explicitlyEnabled(): boolean | undefined {
    return this.configService.get<boolean>('bullBoard.enabled');
  }

  get isProduction(): boolean {
    return this.appConfigService.env === 'production';
  }

  get isDevelopment(): boolean {
    return this.appConfigService.env === 'development';
  }

  /**
   * Determines if Bull Board should be enabled based on environment and configuration
   * - In development: Always enabled (no auth required)
   * - In production: Only enabled if both username and password are configured
   * - Can be explicitly disabled via BULL_BOARD_ENABLED=false
   */
  get isEnabled(): boolean {
    // Check if explicitly disabled
    if (this.explicitlyEnabled === false) {
      return false;
    }

    // Check if explicitly enabled
    if (this.explicitlyEnabled === true) {
      return true;
    }

    // Default behavior based on environment
    if (this.isDevelopment) {
      // Always enabled in development
      return true;
    }

    if (this.isProduction) {
      // Only enabled in production if credentials are configured
      return Boolean(this.username && this.password);
    }

    // Default to disabled for other environments (test, preproduction)
    return false;
  }

  /**
   * Checks if authentication should be required
   * - Only in production with configured credentials
   */
  get requiresAuth(): boolean {
    return this.isProduction && Boolean(this.username && this.password);
  }
}
