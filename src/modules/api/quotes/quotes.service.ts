import { BadRequestException, Injectable } from '@nestjs/common';

import { hashIntent, IntentType } from '@eco-foundation/routes-ts';
import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

import { QuoteRequest } from './schemas/quote-request.schema';
import { QuoteResponse } from './schemas/quote-response.schema';

@Injectable()
export class QuotesService {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly fulfillmentService: FulfillmentService,
  ) {}

  async getQuote(
    intentInput: QuoteRequest['intent'],
    strategyName?: QuoteRequest['strategy'],
  ): Promise<QuoteResponse> {
    // Convert the input to a proper Intent interface with correct types
    const intent = this.convertToIntent(intentInput);

    // Determine strategy to use
    const selectedStrategyName = strategyName || this.fulfillmentConfigService.defaultStrategy;
    const strategy = this.fulfillmentService.getStrategy(
      selectedStrategyName as FulfillmentStrategyName,
    );

    if (!strategy) {
      throw new BadRequestException(`Unknown strategy: ${selectedStrategyName}`);
    }

    // Check if strategy can handle this intent
    if (!strategy.canHandle(intent)) {
      throw new BadRequestException(`Strategy ${selectedStrategyName} cannot handle this intent`);
    }

    // Get quote from strategy
    const quoteResult = await strategy.getQuote(intent);

    // Transform to response format
    const response: QuoteResponse = {
      valid: quoteResult.valid,
      strategy: quoteResult.strategy,
      fees: quoteResult.fees
        ? {
            baseFee: quoteResult.fees.baseFee.toString(),
            percentageFee: quoteResult.fees.percentageFee.toString(),
            totalRequiredFee: quoteResult.fees.totalRequiredFee.toString(),
            currentReward: quoteResult.fees.currentReward.toString(),
            minimumRequiredReward: quoteResult.fees.minimumRequiredReward.toString(),
          }
        : {
            baseFee: '0',
            percentageFee: '0',
            totalRequiredFee: '0',
            currentReward: '0',
            minimumRequiredReward: '0',
          },
      validations: {
        passed: quoteResult.validationResults.filter((v) => v.passed).map((v) => v.validation),
        failed: quoteResult.validationResults
          .filter((v) => !v.passed)
          .map((v) => ({
            validation: v.validation,
            reason: v.error || 'Validation failed',
          })),
      },
    };

    return response;
  }

  private convertToIntent(input: QuoteRequest['intent']): Intent {
    // Generate intent hash if not provided
    const intentHash = hashIntent(input as IntentType).intentHash as Hex;

    return {
      intentHash,
      reward: {
        prover: input.reward.prover as Address,
        creator: input.reward.creator as Address,
        deadline: input.reward.deadline,
        nativeValue: input.reward.nativeValue,
        tokens: input.reward.tokens.map((t) => ({
          amount: t.amount,
          token: t.token as Address,
        })),
      },
      route: {
        source: input.route.source,
        destination: input.route.destination,
        salt: input.route.salt as Hex,
        inbox: input.route.inbox as Address,
        calls: input.route.calls.map((c) => ({
          data: c.data as Hex,
          target: c.target as Address,
          value: c.value,
        })),
        tokens: input.route.tokens.map((t) => ({
          amount: t.amount,
          token: t.token as Address,
        })),
      },
    };
  }
}
