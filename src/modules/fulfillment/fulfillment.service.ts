import { Injectable } from '@nestjs/common';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';
import { StorageFulfillment } from '@/modules/fulfillment/fulfillments/storage.fulfillment';
import { BasicValidationStrategy } from '@/modules/fulfillment/strategies/basic-validation.strategy';
import { IntentsService } from '@/modules/intents/intents.service';
import { QueueService } from '@/modules/queue/queue.service';

@Injectable()
export class FulfillmentService {
  constructor(
    private evmConfigService: EvmConfigService,
    private solanaConfigService: SolanaConfigService,
    private intentsService: IntentsService,
    private queueService: QueueService,
    private validationStrategy: BasicValidationStrategy,
    private storageFulfillment: StorageFulfillment,
  ) {}

  async processIntent(intent: Intent): Promise<void> {
    try {
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.VALIDATING);

      const isValid = await this.validationStrategy.validate(intent);
      if (!isValid) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: 'Validation failed' },
        });
        return;
      }

      const fulfillmentResult = await this.storageFulfillment.canFulfill(intent);
      if (!fulfillmentResult.shouldExecute) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: fulfillmentResult.reason },
        });
        return;
      }

      const walletAddress = this.getWalletAddressForChain(intent.targetChainId);
      await this.queueService.addIntentToExecutionQueue(intent, walletAddress);

      await this.intentsService.updateStatus(intent.intentId, IntentStatus.EXECUTING);
    } catch (error) {
      console.error(`Error processing intent ${intent.intentId}:`, error);
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
        metadata: { error: error.message },
      });
    }
  }

  private getWalletAddressForChain(chainId: string | number): string {
    if (typeof chainId === 'number') {
      return this.evmConfigService.walletAddress;
    } else if (chainId === 'solana-mainnet') {
      return this.solanaConfigService.walletAddress;
    }
    throw new Error(`Unsupported chain: ${chainId}`);
  }
}
