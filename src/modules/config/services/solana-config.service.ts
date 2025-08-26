import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { SolanaSchema } from '@/config/config.schema';

type SolanaConfig = z.infer<typeof SolanaSchema>;

@Injectable()
export class SolanaConfigService {
  constructor(private configService: ConfigService) {}

  get chainId(): SolanaConfig['chainId'] {
    return this.configService.get<string>('solana.chainId');
  }

  get rpcUrl(): SolanaConfig['rpcUrl'] {
    return this.configService.get<string>('solana.rpcUrl');
  }

  get wsUrl(): SolanaConfig['wsUrl'] {
    return this.configService.get<string>('solana.wsUrl');
  }

  get secretKey(): SolanaConfig['secretKey'] {
    return this.configService.get<string>('solana.secretKey');
  }

  get walletAddress(): SolanaConfig['walletAddress'] {
    return this.configService.get<string>('solana.walletAddress');
  }

  get programId(): SolanaConfig['programId'] {
    return this.configService.get<string>('solana.programId');
  }

  get portalProgramId(): SolanaConfig['portalProgramId'] {
    return this.configService.get<string>('solana.portalProgramId');
  }

  isConfigured(): boolean {
    // Check if essential Solana configuration is present
    const config = this.configService.get('solana');
    return !!(config && config.rpcUrl && config.secretKey && config.portalProgramId);
  }
}
