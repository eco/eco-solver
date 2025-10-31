import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { RhinestoneConfig, RhinestoneContractsConfig } from '@/config/schemas/rhinestone.schema';

/**
 * Configuration service for Rhinestone module
 */
@Injectable()
export class RhinestoneConfigService {
  constructor(private readonly configService: NestConfigService) {}

  /**
   * Get WebSocket configuration
   */
  get websocket(): NonNullable<RhinestoneConfig>['websocket'] {
    const config = this.configService.get<RhinestoneConfig>('rhinestone')!;
    return config.websocket;
  }

  /**
   * Get contract addresses (same across all chains)
   * @returns Contract addresses including router, ECO adapter, and ECO arbiter
   * @throws {Error} If contracts are not configured
   */
  getContracts(): RhinestoneContractsConfig {
    const config = this.configService.get<RhinestoneConfig>('rhinestone');

    if (!config) {
      throw new Error('Rhinestone configuration is missing from config.yaml');
    }

    const contracts = config.contracts;

    if (!contracts) {
      throw new Error(
        'Rhinestone contracts not configured. ' +
          'Please add rhinestone.contracts section to config.yaml',
      );
    }

    return contracts;
  }
}
