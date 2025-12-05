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
   * Get contract addresses for a specific chain
   * @param chainId Chain ID to get contracts for
   * @returns Contract addresses including router, ECO adapter, and ECO arbiter
   * @throws {Error} If chain is not configured
   */
  getContracts(chainId: number): RhinestoneContractsConfig {
    const config = this.configService.get<RhinestoneConfig>('rhinestone');

    if (!config) {
      throw new Error('Rhinestone configuration is missing from config.yaml');
    }

    if (!config.chains) {
      throw new Error(
        'Rhinestone chains not configured. ' +
          'Please add rhinestone.chains section to config.yaml',
      );
    }

    const chainConfig = config.chains[chainId];

    if (!chainConfig) {
      throw new Error(
        `Rhinestone chain ${chainId} not configured. ` +
          `Available chains: ${Object.keys(config.chains).join(', ')}`,
      );
    }

    return chainConfig.contracts;
  }

  /**
   * Check if a chain is configured for Rhinestone
   */
  isChainSupported(chainId: number): boolean {
    const config = this.configService.get<RhinestoneConfig>('rhinestone');
    return !!(config?.chains && config.chains[chainId]);
  }

  /**
   * Get all configured chain IDs
   */
  getSupportedChains(): number[] {
    const config = this.configService.get<RhinestoneConfig>('rhinestone');
    if (!config?.chains) return [];
    return Object.keys(config.chains).map(Number);
  }
}
