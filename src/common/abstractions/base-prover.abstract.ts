import { Injectable } from '@nestjs/common';

import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export abstract class BaseProver {
  abstract readonly type: string;

  constructor(protected readonly evmConfigService: EvmConfigService) {}

  abstract getMessageData(intent: Intent): Promise<Hex>;
  abstract getFee(intent: Intent): Promise<bigint>;

  getContractAddress(chainId: number): Address | undefined {
    const chainConfig = this.evmConfigService.getChain(chainId);
    return chainConfig?.provers[this.type];
  }

  isSupported(chainId: number): boolean {
    return Boolean(this.getContractAddress(chainId));
  }
}
