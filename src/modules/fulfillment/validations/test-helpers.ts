import { Address, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

export function createMockValidationContext(overrides?: Partial<ValidationContext>): ValidationContext {
  const defaultContext: ValidationContext = {
    getWalletAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
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
    intentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    reward: {
      prover: '0x1234567890123456789012345678901234567890' as Address,
      creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      nativeValue: BigInt(1000000000000000000), // 1 ETH
      tokens: [],
    },
    route: {
      source: BigInt(1),
      destination: BigInt(10),
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      inbox: '0x9876543210987654321098765432109876543210' as Address,
      calls: [],
      tokens: [],
    },
    status: IntentStatus.PENDING,
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
