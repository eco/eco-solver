import { Injectable, Inject } from '@nestjs/common';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';
import { ProverService } from '@/modules/prover/prover.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { FulfillmentStrategy } from './strategies/fulfillment-strategy.abstract';
import { Validation } from './validations/validation.interface';
import { StandardFulfillmentStrategy } from './strategies/standard-fulfillment.strategy';
import { CrowdLiquidityFulfillmentStrategy } from './strategies/crowd-liquidity-fulfillment.strategy';
import { NativeIntentsFulfillmentStrategy } from './strategies/native-intents-fulfillment.strategy';
import { NegativeIntentsFulfillmentStrategy } from './strategies/negative-intents-fulfillment.strategy';
import { RhinestoneFulfillmentStrategy } from './strategies/rhinestone-fulfillment.strategy';

@Injectable()
export class FulfillmentService {
  private strategies: Map<string, FulfillmentStrategy> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private solanaConfigService: SolanaConfigService,
    private intentsService: IntentsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
    private proverService: ProverService,
    // Inject all strategies
    private standardStrategy: StandardFulfillmentStrategy,
    private crowdLiquidityStrategy: CrowdLiquidityFulfillmentStrategy,
    private nativeIntentsStrategy: NativeIntentsFulfillmentStrategy,
    private negativeIntentsStrategy: NegativeIntentsFulfillmentStrategy,
    private rhinestoneStrategy: RhinestoneFulfillmentStrategy,
  ) {
    // Register strategies by name
    this.strategies.set('standard', this.standardStrategy);
    this.strategies.set('crowd-liquidity', this.crowdLiquidityStrategy);
    this.strategies.set('native-intents', this.nativeIntentsStrategy);
    this.strategies.set('negative-intents', this.negativeIntentsStrategy);
    this.strategies.set('rhinestone', this.rhinestoneStrategy);
  }

  async processIntent(intent: Intent, strategyName: string): Promise<void> {
    try {
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.VALIDATING);

      // Get the strategy by name
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: `Unknown fulfillment strategy: ${strategyName}` },
        });
        return;
      }

      // Verify the strategy can handle this intent
      if (!strategy.canHandle(intent)) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: `Strategy ${strategyName} cannot handle this intent` },
        });
        return;
      }

      // Run strategy validation (which includes all configured validations)
      try {
        await strategy.validate(intent);
      } catch (validationError) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: validationError.message },
        });
        return;
      }

      // Execute the strategy
      await strategy.execute(intent);

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
