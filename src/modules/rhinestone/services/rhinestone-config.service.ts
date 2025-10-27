import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { RhinestoneConfig } from '@/config/schemas/rhinestone.schema';

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
}
