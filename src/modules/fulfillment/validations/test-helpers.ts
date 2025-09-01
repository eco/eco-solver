import { Address, encodeFunctionData, erc20Abi, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { toUniversalAddress } from '@/common/types/universal-address.type';
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
  // Create normalized addresses (padded to 32 bytes)
  const proverAddr = toUniversalAddress(
    '0x0000000000000000000000001234567890123456789012345678901234567890',
  );
  const creatorAddr = toUniversalAddress(
    '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
  );
  const portalAddr = toUniversalAddress(
    '0x0000000000000000000000009876543210987654321098765432109876543210',
  );
  const tokenAddr = toUniversalAddress(
    '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
  );

  const defaultIntent: Intent = {
    intentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    status: IntentStatus.PENDING,
    sourceChainId: BigInt(8453), // Source chain context
    destination: BigInt(10), // Target chain ID
    reward: {
      prover: proverAddr,
      creator: creatorAddr,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      nativeAmount: 0n,
      tokens: [{ token: tokenAddr, amount: 200_000n }],
    },
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      deadline: BigInt(Date.now() + 86400000), // 24 hours from now
      portal: portalAddr,
      nativeAmount: 0n,
      tokens: [{ token: tokenAddr, amount: 100_000n }],
      calls: [
        {
          target: tokenAddr,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address, 100_000n],
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
