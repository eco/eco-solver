import { BadRequestException, Injectable } from '@nestjs/common';

import { hashIntent, IntentType } from '@eco-foundation/routes-ts';
import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

import { QuoteRequest } from './schemas/quote-request.schema';
import { FailedQuoteResponse, QuoteResponse } from './schemas/quote-response.schema';

@Injectable()
export class QuotesService {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly evmConfigService: EvmConfigService,
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

    // If quote is invalid, return validation errors
    if (!quoteResult.valid) {
      const failedResponse: FailedQuoteResponse = {
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
      throw new BadRequestException(failedResponse);
    }

    // Build successful response - sourceChainId should be present after validation
    if (!intent.sourceChainId) {
      throw new BadRequestException('Intent sourceChainId is required');
    }
    const sourceChainId = Number(intent.sourceChainId);
    const destinationChainId = Number(intent.destination);

    // Get contract addresses
    const intentSourceAddress = this.evmConfigService.getIntentSourceAddress(sourceChainId);
    const portalAddress = this.evmConfigService.getPortalAddress(destinationChainId);

    // Get prover address - first try to get from the chain config, fallback to generic prover if needed
    let proverAddress: Address | undefined;
    try {
      // Try to get prover address for the destination chain
      proverAddress =
        this.evmConfigService.getProverAddress(destinationChainId, 'hyper') ||
        this.evmConfigService.getProverAddress(destinationChainId, 'metalayer');
    } catch (error) {
      // If no prover found, use the prover address from reward
      proverAddress = intent.reward.prover;
    }

    // Extract token information from intent
    const sourceToken =
      intent.route.tokens.length > 0
        ? intent.route.tokens[0].token
        : ('0x0000000000000000000000000000000000000000' as Address);
    const destinationToken = sourceToken; // Assuming same token for now
    const sourceAmount = intent.route.tokens.length > 0 ? intent.route.tokens[0].amount : BigInt(0);
    // Assuming 1:1 for now
    // Build the response
    return {
      quoteResponse: {
        sourceChainID: sourceChainId,
        destinationChainID: destinationChainId,
        sourceToken: sourceToken as Hex,
        destinationToken: destinationToken as Hex,
        sourceAmount: sourceAmount.toString(),
        destinationAmount: sourceAmount.toString(),
        funder: intent.reward.creator as Hex,
        refundRecipient: intent.reward.creator as Hex,
        recipient:
          intent.route.calls.length > 0
            ? (intent.route.calls[0].target as Hex)
            : (intent.route.portal as Hex),
        fees: quoteResult.fees
          ? [
              {
                name: 'Eco Protocol Fee' as const,
                description: `Protocol fee for fulfilling intent on chain ${destinationChainId}`,
                token: {
                  address: sourceToken,
                  decimals: 18, // Default to 18, should ideally fetch from token contract
                  symbol: 'TOKEN', // Default symbol, should ideally fetch from token contract
                },
                amount: quoteResult.fees.totalRequiredFee.toString(),
              },
            ]
          : [],
        deadline: Number(intent.reward.deadline),
        estimatedFulfillTimeSec: 30, // Default estimate, can be made configurable
      },
      contracts: {
        intentSource: intentSourceAddress as Hex,
        prover: proverAddress as Hex,
        inbox: portalAddress as Hex,
      },
    };
  }

  private convertToIntent(input: QuoteRequest['intent']): Intent {
    // Generate intent hash if not provided
    const intentHashResult = hashIntent(input as IntentType);
    const intentHash = intentHashResult.intentHash as Hex;

    return {
      intentId: intentHash as Hex,
      destination: input.route.destination,
      reward: {
        prover: input.reward.prover as Address,
        creator: input.reward.creator as Address,
        deadline: input.reward.deadline,
        nativeAmount: input.reward.nativeValue || BigInt(0),
        tokens: input.reward.tokens.map((t) => ({
          amount: t.amount,
          token: t.token as Address,
        })),
      },
      route: {
        salt: input.route.salt as Hex,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // Default 1 hour from now
        portal: input.route.inbox as Address,
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
      sourceChainId: input.route.source,
    };
  }
}
