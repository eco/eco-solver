import { Address, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

export function createMockValidationContext(
  overrides?: Partial<ValidationContext>,
): ValidationContext {
  const defaultContext: ValidationContext = {
    getWalletAddress: jest
      .fn()
      .mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
    getWalletBalance: jest.fn().mockResolvedValue(BigInt(10000000000000000000)), // 10 ETH
    getWalletId: jest.fn().mockResolvedValue('basic'),
  };

  return {
    ...defaultContext,
    ...overrides,
  };
}

export function createMockIntent(overrides?: Partial<Intent>): Intent {
  const defaultIntent: Intent = {
    intentId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    destination: BigInt(10), // Target chain ID
    reward: {
      prover: '0x1234567890123456789012345678901234567890' as Address,
      creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      nativeAmount: BigInt(1000000000000000000), // 1 ETH
      tokens: [],
    },
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      portal: '0x9876543210987654321098765432109876543210' as Address,
      calls: [],
      tokens: [],
    },
    status: IntentStatus.PENDING,
    sourceChainId: BigInt(1), // Source chain context
  };

  return {
    ...defaultIntent,
    ...overrides,
    reward: {
      ...defaultIntent.reward,
      ...(overrides?.reward || {}),
    },
    route: {
      ...defaultIntent.route,
      ...(overrides?.route || {}),
    },
  };
}
