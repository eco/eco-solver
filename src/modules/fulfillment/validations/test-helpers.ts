import { Address, encodeFunctionData, erc20Abi, Hex } from 'viem';

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
    intentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    status: IntentStatus.PENDING,
    sourceChainId: BigInt(8453), // Source chain context
    destination: BigInt(10), // Target chain ID
    reward: {
      prover: '0x1234567890123456789012345678901234567890' as Address,
      creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      nativeAmount: 0n,
      tokens: [{ token: '0x00000002f050fe938943acc45f65568000000000', amount: 200_000n }],
    },
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      portal: '0x9876543210987654321098765432109876543210' as Address,
      nativeAmount: 0n,
      tokens: [{ token: '0x00000002f050fe938943acc45f65568000000000', amount: 100_000n }],
      calls: [
        {
          target: '0x00000002f050fe938943acc45f65568000000000',
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 100_000n],
          }),
        },
      ],
    },
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
