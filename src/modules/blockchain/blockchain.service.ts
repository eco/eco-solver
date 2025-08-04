import { Injectable } from '@nestjs/common';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';

import { EvmExecutorService } from './evm/evm.executor.service';
import { SvmExecutorService } from './svm/svm.executor.service';

@Injectable()
export class BlockchainService {
  private executors: Map<string | number, BaseChainExecutor> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private intentsService: IntentsService,
    private evmExecutor: EvmExecutorService,
    private svmExecutor: SvmExecutorService,
  ) {
    this.initializeExecutors();
  }

  private initializeExecutors() {
    // Register EVM executor for all supported chains
    const evmChainIds = this.evmConfigService.supportedChainIds;
    for (const chainId of evmChainIds) {
      this.executors.set(chainId, this.evmExecutor);
    }

    // Register SVM executor
    this.executors.set('solana-mainnet', this.svmExecutor);
  }

  async executeIntent(intent: Intent, walletId?: string): Promise<void> {
    try {
      const executor = this.executors.get(Number(intent.route.destination));
      if (!executor) {
        throw new Error(`No executor for chain ${intent.route.destination}`);
      }

      const result = await executor.fulfill(intent, walletId);

      if (result.success) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FULFILLED);
        console.log(`Intent ${intent.intentHash} fulfilled: ${result.txHash}`);
      } else {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        console.error(`Intent ${intent.intentHash} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error executing intent ${intent.intentHash}:`, error);
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
    }
  }
}
