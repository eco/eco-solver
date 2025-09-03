import { BadRequestException, Injectable } from '@nestjs/common';

import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

import { QuoteRequest } from './schemas/quote-request.schema';
import { FailedQuoteResponse, QuoteResponse } from './schemas/quote-response.schema';

@Injectable()
export class QuotesService {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {}

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    // Convert the simplified request to a proper Intent interface with correct types
    const intent = this.convertToIntent(request);

    // Always use the default strategy for simplified quotes
    const selectedStrategyName = this.fulfillmentConfigService.defaultStrategy;
    const strategy = this.fulfillmentService.getStrategy(selectedStrategyName);

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
    const portalAddress = this.blockchainConfigService.getPortalAddress(destinationChainId);

    // Get prover address for the destination chain using the default prover
    let proverAddress: Address | undefined;
    try {
      const defaultProver = this.blockchainConfigService.getDefaultProver(destinationChainId);
      const proverAddressUA = this.blockchainConfigService.getProverAddress(
        destinationChainId,
        defaultProver,
      );

      if (proverAddressUA) {
        proverAddress = AddressNormalizer.denormalizeToEvm(proverAddressUA);
      }
    } catch (error) {
      // If no prover found, denormalize the prover address from reward
      const destChainType = ChainTypeDetector.detect(destinationChainId);
      const denormalized = AddressNormalizer.denormalize(intent.reward.prover, destChainType);
      proverAddress =
        typeof denormalized === 'string' ? (denormalized as `0x${string}`) : undefined;
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
        prover: proverAddress || '',
        portal: portalAddress || '',
      },
    };
  }

  private convertToIntent(request: QuoteRequest): Intent {
    const { quoteRequest } = request;
    const sourceChainId = BigInt(quoteRequest.sourceChainID);
    const destinationChainId = BigInt(quoteRequest.destinationChainID);
    // Determine source chain type for normalization
    const sourceChainType = ChainTypeDetector.detect(sourceChainId);
    const destinationChainType = ChainTypeDetector.detect(destinationChainId);

    // Generate a random salt for intent uniqueness
    const salt = ('0x' +
      Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(
        '',
      )) as Hex;

    // Set deadline to 1 hour from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Get portal address for destination chain
    const portalAddressUA = this.blockchainConfigService.getPortalAddress(
      Number(destinationChainId),
    );
    if (!portalAddressUA) {
      throw new BadRequestException(
        `Portal address not configured for chain ${destinationChainId}`,
      );
    }
    const portalAddressDenorm = AddressNormalizer.denormalize(
      portalAddressUA,
      destinationChainType,
    );
    // Cast to BlockchainAddress - we know it's valid since it came from our config
    const portalAddress = (
      destinationChainType === ChainType.SVM ? String(portalAddressDenorm) : portalAddressDenorm
    ) as BlockchainAddress;

    // Get default prover for the source chain
    const defaultProver = this.blockchainConfigService.getDefaultProver(Number(sourceChainId));
    const proverAddressUA = this.blockchainConfigService.getProverAddress(
      Number(sourceChainId),
      defaultProver,
    );
    if (!proverAddressUA) {
      throw new BadRequestException(`Default prover ${defaultProver} not configured for chain ${sourceChainId}`);
    }
    const proverAddressDenorm = AddressNormalizer.denormalize(proverAddressUA, sourceChainType);
    // Cast to BlockchainAddress - we know it's valid since it came from our config
    const proverAddress = (
      sourceChainType === ChainType.SVM ? String(proverAddressDenorm) : proverAddressDenorm
    ) as BlockchainAddress;

    // Create the route and reward objects from simplified input
    const route = {
      salt,
      deadline,
      portal: AddressNormalizer.normalize(portalAddress, destinationChainType),
      nativeAmount: BigInt(0), // No native amount for token swaps
      tokens: [
        {
          amount: BigInt(quoteRequest.sourceAmount),
          token: AddressNormalizer.normalize(quoteRequest.destinationToken, destinationChainType),
        },
      ],
      calls: [
        {
          data: '0x' as Hex, // Empty data for simple transfer
          target: AddressNormalizer.normalize(quoteRequest.recipient, destinationChainType),
          value: BigInt(0),
        },
      ],
    };

    const reward = {
      deadline,
      creator: AddressNormalizer.normalize(quoteRequest.funder, sourceChainType),
      prover: AddressNormalizer.normalize(proverAddress, sourceChainType),
      nativeAmount: BigInt(0), // Fee will be calculated by the strategy
      tokens: [], // No token rewards for simplified quotes
    };

    // Generate intent hash using the new Viem-based function
    const { intentHash } = PortalHashUtils.getIntentHash({
      intentHash: '0x' as Hex, // Placeholder, will be replaced by computed hash
      destination: destinationChainId,
      sourceChainId,
      route,
      reward,
    });

    return {
      intentHash,
      destination: destinationChainId,
      reward,
      route,
      sourceChainId,
    };
  }
}
