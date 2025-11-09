import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IndexerConfig } from '@/config/schemas/evm.schema';

@Injectable()
export class IndexerConfigService {
  constructor(private readonly configService: ConfigService) {}

  get config(): IndexerConfig | undefined {
    return this.configService.get<IndexerConfig>('evm.indexer');
  }

  get url(): string {
    const config = this.config;
    if (!config) {
      throw new Error('Indexer configuration is not defined');
    }
    return config.url;
  }

  get intervals() {
    return (
      this.config?.intervals ?? {
        intentPublished: 2000,
        intentFunded: 5000,
        intentFulfilled: 5000,
        intentWithdrawn: 60000,
      }
    );
  }

  isConfigured(): boolean {
    return !!this.config;
  }
}
