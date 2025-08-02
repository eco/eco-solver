import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { EvmSchema } from '@/config/config.schema';

type EvmConfig = z.infer<typeof EvmSchema>;

@Injectable()
export class EvmConfigService {
  constructor(private configService: ConfigService) {}

  get rpcUrl(): EvmConfig['rpcUrl'] {
    return this.configService.get<string>('evm.rpcUrl');
  }

  get wsUrl(): EvmConfig['wsUrl'] {
    return this.configService.get<string>('evm.wsUrl');
  }

  get chainId(): EvmConfig['chainId'] {
    return this.configService.get<number>('evm.chainId');
  }

  get privateKey(): EvmConfig['privateKey'] {
    return this.configService.get<string>('evm.privateKey');
  }

  get walletAddress(): EvmConfig['walletAddress'] {
    return this.configService.get<string>('evm.walletAddress');
  }

  get intentSourceAddress(): EvmConfig['intentSourceAddress'] {
    return this.configService.get<string>('evm.intentSourceAddress');
  }

  get inboxAddress(): EvmConfig['inboxAddress'] {
    return this.configService.get<string>('evm.inboxAddress');
  }
}
