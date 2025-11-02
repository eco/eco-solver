import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ChainInfo } from '@/common/interfaces/chain-info.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService } from '@/modules/config/services';

import { ChainsResponse } from '../schemas/chains-response.schema';

@Injectable()
export class BlockchainInfoService {
  constructor(
    @InjectPinoLogger(BlockchainInfoService.name) private readonly logger: PinoLogger,
    private readonly blockchainReaderService: BlockchainReaderService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {}

  async getAllChains(): Promise<ChainsResponse> {
    const chains: ChainInfo[] = [];

    // Get all configured chain IDs
    const configuredChains = this.blockchainConfigService.getAllConfiguredChains();

    // Get chain info for each configured chain
    for (const chainId of configuredChains) {
      try {
        const chainInfo = await this.blockchainReaderService.getChainInfo(chainId);

        // Handle both single ChainInfo and array of ChainInfo
        if (Array.isArray(chainInfo)) {
          chains.push(...chainInfo);
        } else {
          chains.push(chainInfo);
        }
      } catch (error) {
        this.logger.warn(`Failed to get chain info for chain ${chainId}: ${error}`);
      }
    }

    return chains;
  }
}
