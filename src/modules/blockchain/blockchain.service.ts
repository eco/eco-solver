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
    const evmChainId = this.evmConfigService.chainId;
    this.executors.set(evmChainId, this.evmExecutor);
    this.executors.set('solana-mainnet', this.svmExecutor);
  }

  async executeIntent(intent: Intent, walletId?: string): Promise<void> {
    try {
      const executor = this.executors.get(Number(intent.route.destination));
      if (!executor) {
        throw new Error(`No executor for chain ${intent.route.destination}`);
      }

      const result = await executor.execute(intent, walletId);

      if (result.success) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FULFILLED);
        console.log(`Intent ${intent.intentId} fulfilled: ${result.txHash}`);
      } else {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED);
        console.error(`Intent ${intent.intentId} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error executing intent ${intent.intentId}:`, error);
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED);
    }
  }
}
