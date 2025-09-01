import { BadRequestException, Injectable } from '@nestjs/common';

import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

import { QuoteRequest } from './schemas/quote-request.schema';
import { FailedQuoteResponse, QuoteResponse } from './schemas/quote-response.schema';

@Injectable()
export class QuotesService {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly blockchainConfigService: BlockchainConfigService,
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
    const portalAddress = this.blockchainConfigService.getPortalAddress(
      destinationChainId,
    ) as Address;

    // Get prover address - first try to get from the chain config, fallback to generic prover if needed
    let proverAddress: Address | undefined;
    try {
      // Try to get prover address for the destination chain
      proverAddress =
        (this.blockchainConfigService.getProverAddress(destinationChainId, 'hyper') as Address) ||
        (this.blockchainConfigService.getProverAddress(destinationChainId, 'metalayer') as Address);
    } catch (error) {
      // If no prover found, denormalize the prover address from reward
      const destChainType = ChainTypeDetector.detect(destinationChainId);
      proverAddress = AddressNormalizer.denormalize(intent.reward.prover, destChainType) as Address;
    }

    // TODO: Complete implementation

    // Extract token information from intent
    const sourceToken = intent.route.tokens[0].token as any;
    const destinationToken = sourceToken; // Assuming the same token for now
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
        prover: proverAddress,
        portal: portalAddress,
      },
    };
  }

  private convertToIntent(input: QuoteRequest['intent']): Intent {
    // Determine source chain type for normalization
    const sourceChainType = ChainTypeDetector.detect(input.route.source);
    const destinationChainType = ChainTypeDetector.detect(input.route.destination);

    // Generate intent hash using the new Viem-based function
    const { intentHash } = PortalHashUtils.getIntentHash({
      intentHash: '0x' as Hex, // Placeholder, will be replaced by computed hash
      destination: input.route.destination,
      route: {
        salt: input.route.salt as Hex,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // Default 1 hour from now
        portal: AddressNormalizer.normalize(input.route.portal, destinationChainType),
        nativeAmount: input.route.nativeAmount || BigInt(0),
        tokens: input.route.tokens.map((t) => ({
          amount: t.amount,
          token: AddressNormalizer.normalize(t.token, destinationChainType),
        })),
        calls: input.route.calls.map((c) => ({
          data: c.data as Hex,
          target: AddressNormalizer.normalize(c.target, destinationChainType),
          value: c.value,
        })),
      },
      reward: {
        deadline: input.reward.deadline,
        creator: AddressNormalizer.normalize(input.reward.creator, sourceChainType),
        prover: AddressNormalizer.normalize(input.reward.prover, sourceChainType),
        nativeAmount: input.reward.nativeAmount || BigInt(0),
        tokens: input.reward.tokens.map((t) => ({
          amount: t.amount,
          token: AddressNormalizer.normalize(t.token, sourceChainType),
        })),
      },
    });

    return {
      intentHash: intentHash,
      destination: input.route.destination,
      reward: {
        prover: AddressNormalizer.normalize(input.reward.prover, sourceChainType),
        creator: AddressNormalizer.normalize(input.reward.creator, sourceChainType),
        deadline: input.reward.deadline,
        nativeAmount: input.reward.nativeAmount || BigInt(0),
        tokens: input.reward.tokens.map((t) => ({
          amount: t.amount,
          token: AddressNormalizer.normalize(t.token, sourceChainType),
        })),
      },
      route: {
        salt: input.route.salt as Hex,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // Default 1 hour from now
        portal: AddressNormalizer.normalize(input.route.portal, sourceChainType),
        nativeAmount: input.route.nativeAmount || BigInt(0),
        calls: input.route.calls.map((c) => ({
          data: c.data as Hex,
          target: AddressNormalizer.normalize(c.target, sourceChainType),
          value: c.value,
        })),
        tokens: input.route.tokens.map((t) => ({
          amount: t.amount,
          token: AddressNormalizer.normalize(t.token, sourceChainType),
        })),
      },
      sourceChainId: input.route.source,
    };
  }
}
