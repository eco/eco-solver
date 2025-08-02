import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvmConfig } from '@/modules/config/interfaces';

@Injectable()
export class EvmConfigService implements EvmConfig {
  constructor(private configService: ConfigService) {}

  get rpcUrl(): string {
    return this.configService.get<string>('evm.rpcUrl');
  }

  get wsUrl(): string {
    return this.configService.get<string>('evm.wsUrl');
  }

  get chainId(): number {
    return this.configService.get<number>('evm.chainId');
  }

  get privateKey(): string {
    return this.configService.get<string>('evm.privateKey');
  }

  get walletAddress(): string {
    return this.configService.get<string>('evm.walletAddress');
  }

  get intentSourceAddress(): string {
    return this.configService.get<string>('evm.intentSourceAddress');
  }

  get inboxAddress(): string {
    return this.configService.get<string>('evm.inboxAddress');
  }
}