import { parseIntentFulfilled, parseIntentPublish } from '../events';

// Mock the dependencies
jest.mock('viem', () => ({
  getAbiItem: jest.fn(() => ({
    inputs: [
      {
        components: [{}, {}],
      },
    ],
  })),
  decodeEventLog: jest.fn((params) => {
    if (params.eventName === 'IntentPublished') {
      return {
        eventName: 'IntentPublished',
        args: {
          intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
          destination: 1n,
          route: '0x0000000000000000000000000000000000000000000000000000000000000000',
          creator: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          prover: '0x1234567890123456789012345678901234567890',
          rewardDeadline: 1738899900n,
          rewardNativeAmount: 1000000000000000000n,
          rewardTokens: [],
        },
      };
    } else if (params.eventName === 'IntentFulfilled') {
      return {
        eventName: 'IntentFulfilled',
        args: {
          intentHash: params.topics[1],
          claimant: params.topics[2],
        },
      };
    }
    return {};
  }),
}));

jest.mock('@/common/utils/address-normalizer', () => ({
  AddressNormalizer: {
    normalize: jest.fn((address) => `normalized_${address}`),
  },
}));

jest.mock('@/common/utils/chain-type-detector', () => ({
  ChainTypeDetector: {
    detect: jest.fn(() => 'EVM'),
  },
  ChainType: {
    EVM: 'EVM',
  },
}));

jest.mock('@/common/utils/portal-encoder', () => ({
  PortalEncoder: {
    decodeFromChain: jest.fn(() => ({
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      deadline: 1234567890n,
      portal: 'normalized_portal',
      nativeAmount: 0n,
      tokens: [],
      calls: [],
    })),
  },
}));

describe('Event Parsing', () => {
  describe('parseIntentPublish', () => {
    it('should parse IntentPublished event correctly', () => {
      const mockLog = {
        topics: [
          '0x0000000000000000000000000000000000000000000000000000000000000000', // event signature
          '0x0000000000000000000000000000000000000000000000000000000000000001', // intentHash (indexed)
          '0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // creator (indexed)
          '0x0000000000000000000000001234567890123456789012345678901234567890', // prover (indexed)
        ],
        data:
          '0x' +
          '0000000000000000000000000000000000000000000000000000000000000001' + // destination
          '00000000000000000000000000000000000000000000000000000000000000e0' + // route offset
          '000000000000000000000000000000000000000000000000000000006789abcd' + // rewardDeadline
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000' + // rewardNativeAmount (1 ETH)
          '0000000000000000000000000000000000000000000000000000000000000140' + // rewardTokens offset
          '0000000000000000000000000000000000000000000000000000000000000020' + // route length
          '0000000000000000000000000000000000000000000000000000000000000000' + // route data
          '0000000000000000000000000000000000000000000000000000000000000000', // rewardTokens (empty array)
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        blockNumber: 100n,
      };

      const sourceChainId = 1n;
      const intent = parseIntentPublish(sourceChainId, mockLog);

      expect(intent).toBeDefined();
      expect(intent.intentHash).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      );
      expect(intent.sourceChainId).toBe(sourceChainId);
      expect(intent.destination).toBe(1n);
      expect(intent.reward).toBeDefined();
      expect(intent.reward.creator).toBe('normalized_0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(intent.reward.prover).toBe('normalized_0x1234567890123456789012345678901234567890');
      expect(intent.route).toBeDefined();
    });
  });

  describe('parseIntentFulfilled', () => {
    it('should parse IntentFulfilled event correctly', () => {
      const mockLog = {
        topics: [
          '0x0000000000000000000000000000000000000000000000000000000000000000', // event signature
          '0x0000000000000000000000000000000000000000000000000000000000000001', // intentHash (indexed)
          '0x0000000000000000000000000000000000000000000000000000000000000002', // claimant (indexed)
        ],
        data: '0x',
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        blockNumber: 100n,
      };

      const chainId = 1n;
      const event = parseIntentFulfilled(chainId, mockLog);

      expect(event).toBeDefined();
      expect(event.intentHash).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      );
      expect(event.claimant).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000002',
      );
      expect(event.chainId).toBe(chainId);
      expect(event.transactionHash).toBe(mockLog.transactionHash);
      expect(event.blockNumber).toBe(mockLog.blockNumber);
    });

    it('should handle IntentFulfilled event without block number', () => {
      const mockLog = {
        topics: [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0xabcdef0000000000000000000000000000000000000000000000000000000001',
          '0xfedcba0000000000000000000000000000000000000000000000000000000002',
        ],
        data: '0x',
        transactionHash: '0xabcdef1234567890',
      };

      const chainId = 10n;
      const event = parseIntentFulfilled(chainId, mockLog);

      expect(event.intentHash).toBe(
        '0xabcdef0000000000000000000000000000000000000000000000000000000001',
      );
      expect(event.claimant).toBe(
        '0xfedcba0000000000000000000000000000000000000000000000000000000002',
      );
      expect(event.chainId).toBe(chainId);
      expect(event.transactionHash).toBe(mockLog.transactionHash);
      expect(event.blockNumber).toBeUndefined();
    });
  });
});
