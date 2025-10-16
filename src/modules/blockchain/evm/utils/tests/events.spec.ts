// Mock dependencies
import { encodeAbiParameters, encodeEventTopics, getAbiItem } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';

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
    decode: jest.fn(() => ({
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
      // Get the event ABI item
      const eventAbi = getAbiItem({ abi: portalAbi, name: 'IntentPublished' });

      // Create proper event topics using viem
      const topics = encodeEventTopics({
        abi: [eventAbi],
        eventName: 'IntentPublished',
        args: {
          intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
          creator: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          prover: '0x1234567890123456789012345678901234567890',
        },
      });

      // Encode event data properly using encodeAbiParameters
      const data = encodeAbiParameters(
        [
          { type: 'uint64', name: 'destination' },
          { type: 'bytes', name: 'route' },
          { type: 'uint64', name: 'rewardDeadline' },
          { type: 'uint256', name: 'rewardNativeAmount' },
          {
            type: 'tuple[]',
            name: 'rewardTokens',
            components: [{ type: 'address' }, { type: 'uint256' }],
          },
        ],
        [1n, '0x00', 1738899900n, 1000000000000000000n, []],
      );

      const mockLog: any = {
        topics,
        data,
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        blockNumber: 100n,
      };

      const sourceChainId = 1n;
      const intent = EvmEventParser.parseIntentPublish(sourceChainId, mockLog);

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
      // Get the event ABI item
      const eventAbi = getAbiItem({ abi: portalAbi, name: 'IntentFulfilled' });

      // Create proper event topics using viem
      const topics = encodeEventTopics({
        abi: [eventAbi],
        eventName: 'IntentFulfilled',
        args: {
          intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
          claimant: '0x0000000000000000000000000000000000000000000000000000000000000002',
        },
      });

      const mockLog: any = {
        topics,
        data: '0x',
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        blockNumber: 100n,
      };

      const chainId = 1n;
      const event = EvmEventParser.parseIntentFulfilled(chainId, mockLog);

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
      // Get the event ABI item
      const eventAbi = getAbiItem({ abi: portalAbi, name: 'IntentFulfilled' });

      // Create proper event topics using viem
      const topics = encodeEventTopics({
        abi: [eventAbi],
        eventName: 'IntentFulfilled',
        args: {
          intentHash: '0xabcdef0000000000000000000000000000000000000000000000000000000001',
          claimant: '0xfedcba0000000000000000000000000000000000000000000000000000000002',
        },
      });

      const mockLog: any = {
        topics,
        data: '0x',
        transactionHash: '0xabcdef1234567890',
      };

      const chainId = 10n;
      const event = EvmEventParser.parseIntentFulfilled(chainId, mockLog);

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
