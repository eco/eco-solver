import { Injectable } from '@nestjs/common';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { EvmExecutor } from '@/modules/execution/executors/evm.executor';
import { SolanaExecutor } from '@/modules/execution/executors/solana.executor';
import { IntentsService } from '@/modules/intents/intents.service';

@Injectable()
export class ExecutionService {
  private executors: Map<string | number, BaseChainExecutor> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private intentsService: IntentsService,
    private evmExecutor: EvmExecutor,
    private solanaExecutor: SolanaExecutor,
  ) {
    this.initializeExecutors();
  }

  private initializeExecutors() {
    const evmChainId = this.evmConfigService.chainId;
    this.executors.set(evmChainId, this.evmExecutor);
    this.executors.set('solana-mainnet', this.solanaExecutor);
  }

  async executeIntent(intent: Intent): Promise<void> {
    try {
      const executor = this.executors.get(intent.targetChainId);
      if (!executor) {
        throw new Error(`No executor for chain ${intent.targetChainId}`);
      }

      const result = await executor.execute(intent);

      if (result.success) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FULFILLED, {
          fulfillmentTxHash: result.txHash,
        });
        console.log(`Intent ${intent.intentId} fulfilled: ${result.txHash}`);
      } else {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { error: result.error },
        });
        console.error(`Intent ${intent.intentId} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error executing intent ${intent.intentId}:`, error);
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
        metadata: { error: error.message },
      });
    }
  }
}
