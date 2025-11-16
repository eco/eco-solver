import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { sum } from '@/common/utils/math';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { TokenConfigService } from '@/modules/config/services/token-config.service';

export interface FeeCalculationResult {
  baseFee: bigint;
  percentageFee: bigint;
  totalFee: bigint;
  rewardTokens: bigint;
  rewardNative: bigint;
  routeTokens: bigint;
  routeNative: bigint;
  routeMaximumTokens: bigint;
  feeConfig: AssetsFeeSchemaType;
}

/**
 * Shared fee calculation logic for intent validations.
 * Normalizes tokens to 18 decimals, calculates base + percentage fees.
 */
export class FeeCalculationHelper {
  static calculateFees(
    intent: Intent,
    feeConfig: AssetsFeeSchemaType,
    tokenConfigService: TokenConfigService,
  ): FeeCalculationResult {
    const baseFee = normalize(parseUnits(feeConfig.tokens.flatFee.toString(), 18), 18);

    const rewardTokens = sum(
      tokenConfigService.normalize(intent.sourceChainId, intent.reward.tokens),
      'amount',
    );
    const rewardNative = intent.reward.nativeAmount;

    const routeTokens = sum(
      tokenConfigService.normalize(intent.destination, intent.route.tokens),
      'amount',
    );
    const routeNative = intent.route.nativeAmount;

    // Percentage fee: (rewardTokens * scalarBps) / 100,000,000
    const base = 10_000;
    const scalarBpsInt = BigInt(Math.floor(feeConfig.tokens.scalarBps * base));
    const percentageFee = (rewardTokens * scalarBpsInt) / BigInt(base * 10000);
    const totalFee = baseFee + percentageFee;

    const routeMaximumTokens = rewardTokens > totalFee ? rewardTokens - totalFee : 0n;

    return {
      baseFee,
      percentageFee,
      totalFee,
      rewardTokens,
      rewardNative,
      routeTokens,
      routeNative,
      routeMaximumTokens,
      feeConfig,
    };
  }
}
