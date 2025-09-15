import crypto from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { denormalize } from '@/common/tokens/normalize';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { hours, now } from '@/common/utils/time';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

import { QuoteRequest } from '../schemas/quote-request.schema';
import { FailedQuoteResponse, QuoteResponse } from '../schemas/quote-response.schema';

@Injectable()
export class QuotesService {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly blockchainReaderService: BlockchainReaderService,
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

    // Build a successful response - sourceChainId should be present after validation
    if (!intent.sourceChainId) {
      throw new BadRequestException('Intent sourceChainId is required');
    }
    const sourceChainId = Number(intent.sourceChainId);
    const destinationChainId = Number(intent.destination);

    const sourceChainType = ChainTypeDetector.detect(sourceChainId);
    const destinationChainType = ChainTypeDetector.detect(destinationChainId);

    // Get portal address for a destination chain
    const sourcePortalAddressUA = this.blockchainConfigService.getPortalAddress(sourceChainId);
    if (!sourcePortalAddressUA) {
      throw new BadRequestException(
        `Portal address not configured for chain ${destinationChainId}`,
      );
    }

    // TODO: Validate contracts field in the request object

    // Extract token information from intent
    const sourceToken = intent.reward.tokens[0].token;

    const destinationToken = intent.route.tokens[0].token; // Assuming the same token for now
    const sourceAmount = intent.route.tokens[0].amount;

    // Get token configuration from BlockchainConfigService
    const rewardTokenConfig = this.blockchainConfigService.getTokenConfig(
      sourceChainId,
      sourceToken,
    );
    const routeTokenConfig = this.blockchainConfigService.getTokenConfig(
      destinationChainId,
      destinationToken,
    );

    const fee = denormalize(quoteResult.fees!.fee, routeTokenConfig.decimals);

    // TODO: Get quote should return the destination amount from the source
    const destinationAmount = sourceAmount - fee;

    // Construct the token transfer call using buildTokenTransferCalldata
    const recipientAddress = AddressNormalizer.normalize(
      request.quoteRequest.recipient,
      destinationChainType,
    );
    const tokenTransferCall = this.blockchainReaderService.buildTokenTransferCalldata(
      destinationChainId,
      recipientAddress,
      destinationToken,
      destinationAmount,
    );

    const route = {
      ...intent.route,
      calls: [tokenTransferCall],
      tokens: intent.route.tokens.map((token) => ({ ...token, amount: destinationAmount })),
    } satisfies Intent['route'];

    const encodedRoute = PortalEncoder.encode(route, destinationChainType);

    // Build the response
    return {
      quoteResponse: {
        sourceChainID: sourceChainId,
        destinationChainID: destinationChainId,
        sourceToken: AddressNormalizer.denormalize(sourceToken, sourceChainType),
        destinationToken: AddressNormalizer.denormalize(destinationToken, destinationChainType),
        sourceAmount: sourceAmount.toString(),
        destinationAmount: destinationAmount.toString(),
        funder: AddressNormalizer.denormalize(intent.reward.creator, sourceChainType),
        refundRecipient: AddressNormalizer.denormalize(intent.reward.creator, sourceChainType),
        recipient: request.quoteRequest.recipient,
        fees: quoteResult.fees
          ? [
              {
                name: 'Eco Protocol Fee' as const,
                description: `Protocol fee for fulfilling intent on chain ${destinationChainId}`,
                token: {
                  address: request.quoteRequest.sourceToken,
                  decimals: rewardTokenConfig.decimals,
                  symbol: rewardTokenConfig.symbol,
                },
                amount: fee.toString(),
              },
            ]
          : [],
        deadline: Number(intent.reward.deadline),
        estimatedFulfillTimeSec: 30, // Default estimate can be made configurable
        encodedRoute,
      },
      contracts: {
        sourcePortal: AddressNormalizer.denormalize(sourcePortalAddressUA, sourceChainType),
        destinationPortal: AddressNormalizer.denormalize(intent.route.portal, destinationChainType),
        prover: AddressNormalizer.denormalize(intent.reward.prover, sourceChainType),
      },
    };
  }

  private convertToIntent(request: QuoteRequest): Intent {
    const { quoteRequest } = request;
    const sourceChainId = BigInt(quoteRequest.sourceChainID);
    const destinationChainId = BigInt(quoteRequest.destinationChainID);
    // Determine a source chain type for normalization
    const sourceChainType = ChainTypeDetector.detect(sourceChainId);
    const destinationChainType = ChainTypeDetector.detect(destinationChainId);

    // Generate a random salt for intent uniqueness
    const salt = this.generateSalt();

    // Set the deadline to 2 hours from now
    const deadline = now() + hours(2);

    // Get portal address for a destination chain
    const portalAddressUA = this.blockchainConfigService.getPortalAddress(
      Number(destinationChainId),
    );
    if (!portalAddressUA) {
      throw new BadRequestException(
        `Portal address not configured for chain ${destinationChainId}`,
      );
    }

    // Get default prover for the source chain
    const defaultProver = this.blockchainConfigService.getDefaultProver(Number(sourceChainId));
    const proverAddressUA = this.blockchainConfigService.getProverAddress(
      Number(sourceChainId),
      defaultProver,
    );
    if (!proverAddressUA) {
      throw new BadRequestException(
        `Default prover ${defaultProver} not configured for chain ${sourceChainId}`,
      );
    }

    // Create the route and reward objects from simplified input
    const route = {
      salt,
      deadline: BigInt(deadline),
      portal: portalAddressUA,
      nativeAmount: BigInt(0), // No native amount for token swaps
      tokens: [
        {
          amount: BigInt(quoteRequest.sourceAmount),
          token: AddressNormalizer.normalize(quoteRequest.destinationToken, destinationChainType),
        },
      ],
      calls: [],
    };

    const reward = {
      deadline: BigInt(deadline),
      creator: AddressNormalizer.normalize(quoteRequest.funder, sourceChainType),
      prover: proverAddressUA,
      nativeAmount: BigInt(0), // Fee will be calculated by the strategy
      tokens: [
        {
          token: AddressNormalizer.normalize(request.quoteRequest.sourceToken, sourceChainType),
          amount: request.quoteRequest.sourceAmount,
        },
      ], // No token rewards for simplified quotes
    } as const;

    // Generate intent hash using the new Viem-based function
    const { intentHash } = PortalHashUtils.getIntentHash({
      intentHash: '0x' as Hex, // Placeholder will be replaced by computed hash
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

  private generateSalt(): Hex {
    const randomBytes = new Uint8Array(32);
    crypto.randomFillSync(randomBytes);
    return ('0x' + Buffer.from(randomBytes).toString('hex')) as Hex;
  }
}
