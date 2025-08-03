import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { ProversSchema } from '@/config/config.schema';

type ProverConfig = z.infer<typeof ProversSchema>;

@Injectable()
export class ProverConfigService {
  constructor(private configService: ConfigService) {}

  get provers(): ProverConfig {
    return this.configService.get<ProverConfig>('provers', []);
  }

  getProverConfig(type: string) {
    const provers = this.provers;
    return provers.find((prover) => prover.type === type);
  }

  getChainConfig(type: string, chainId: string | number) {
    const proverConfig = this.getProverConfig(type);
    if (!proverConfig) return null;

    const chainKey = String(chainId);
    return proverConfig.chainConfigs.find((config) => String(config.chainId) === chainKey);
  }
}
