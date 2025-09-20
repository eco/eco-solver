import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { formatUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class ExecutorBalanceValidation implements Validation {
  constructor(
    private readonly blockchainReaderService: BlockchainReaderService,
    private readonly otelService: OpenTelemetryService,
    private readonly tokenConfigService: TokenConfigService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const span = api.trace.getActiveSpan();

    span?.setAttributes({
      'validation.name': 'ExecutorBalanceValidation',
      'intent.hash': intent.intentHash,
      'intent.destination_chain': intent.destination?.toString(),
      'route.tokens.count': intent.route.tokens?.length || 0,
    });

    try {
      // This should verify that the executor has enough funds to execute the fulfillment
      // on the destination chain

      const chainID = intent.destination;

      const checkRequests = intent.route.tokens.map(async ({ token, amount }, index) => {
        const balance = await context.getWalletBalance(chainID, token);

        span?.setAttributes({
          [`executor.balance.${index}.token`]: token,
          [`executor.balance.${index}.required`]: amount.toString(),
          [`executor.balance.${index}.actual`]: balance.toString(),
          [`executor.balance.${index}.sufficient`]: balance >= amount,
        });

        return { enough: balance >= amount, token, balance, required: amount };
      });

      const checks = await Promise.all(checkRequests);

      const notEnough = checks.filter((check) => !check.enough);

      if (notEnough.length) {
        const tokens = notEnough.map(({ token }) => token);
        const destinationChainType = ChainTypeDetector.detect(chainID);
        const walletAddressUA = await context.getWalletAddress(chainID);
        const walletAddress = AddressNormalizer.denormalize(walletAddressUA, destinationChainType);

        // Create detailed balance information for each insufficient token with user-friendly formatting
        const balanceDetails = notEnough
          .map(({ token, balance, required }) => {
            const tokenConfig = this.tokenConfigService.getTokenConfig(Number(chainID), token);
            const tokenAddress = AddressNormalizer.denormalize(token, destinationChainType);
            const balanceFormatted = formatUnits(balance, tokenConfig.decimals);
            const requiredFormatted = formatUnits(required, tokenConfig.decimals);
            return `${tokenConfig.symbol || tokenAddress} (has: ${balanceFormatted}, needs: ${requiredFormatted})`;
          })
          .join(', ');

        span?.setAttribute('executor.balance.insufficient_tokens', tokens.join(', '));
        throw new ValidationError(
          `Not enough token balance on chain ${chainID} for wallet ${walletAddress}. Insufficient tokens: ${balanceDetails}`,
          ValidationErrorType.PERMANENT,
          'ExecutorBalanceValidation',
        );
      }

      span?.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span?.recordException(error as Error);
      span?.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    }
  }
}
