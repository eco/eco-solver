import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SolanaConfig } from '@/modules/config/interfaces';

@Injectable()
export class SolanaConfigService implements SolanaConfig {
  constructor(private configService: ConfigService) {}

  get rpcUrl(): string {
    return this.configService.get<string>('solana.rpcUrl');
  }

  get wsUrl(): string {
    return this.configService.get<string>('solana.wsUrl');
  }

  get secretKey(): string {
    return this.configService.get<string>('solana.secretKey');
  }

  get walletAddress(): string {
    return this.configService.get<string>('solana.walletAddress');
  }

  get programId(): string {
    return this.configService.get<string>('solana.programId');
  }
}