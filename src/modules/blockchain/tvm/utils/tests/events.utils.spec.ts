import { parseTvmIntentFulfilled, parseTvmIntentPublished } from '../events.utils';

// Mock TvmUtilsService
jest.mock('@/modules/blockchain/tvm/services/tvm-utils.service', () => ({
  TvmUtilsService: {
    fromHex: jest.fn((hex) => `0x${hex}`),
  },
}));

describe('TVM Event Utils', () => {
  describe('parseTvmIntentFulfilled', () => {
    it('should parse IntentFulfilled event correctly', () => {
      const mockEvent = {
        event_name: 'IntentFulfilled',
        transaction_id: 'abc123def456',
        block_number: '12345678',
        result: {
          intentHash: '0x1234567890abcdef',
          claimant: '0xabcdefabcdef',
        },
      };

      const chainId = 1000n; // TVM chain ID
      const result = parseTvmIntentFulfilled(chainId, mockEvent);

      expect(result).toEqual({
        intentHash: '0x1234567890abcdef',
        claimant: '0xabcdefabcdef',
        chainId,
        transactionHash: 'abc123def456',
        blockNumber: 12345678n,
      });
    });

    it('should handle event without block number', () => {
      const mockEvent = {
        event_name: 'IntentFulfilled',
        transaction_id: 'xyz789',
        result: {
          hash: '0xaaaaaa', // Alternative field name
          claimant: '0xbbbbbb',
        },
      };

      const chainId = 2000n;
      const result = parseTvmIntentFulfilled(chainId, mockEvent);

      expect(result).toEqual({
        intentHash: '0xaaaaaa',
        claimant: '0xbbbbbb',
        chainId,
        transactionHash: 'xyz789',
        blockNumber: undefined,
      });
    });
  });

  describe('parseTvmIntentPublished', () => {
    it('should parse IntentPublished event correctly', () => {
      const mockEvent = {
        event_name: 'IntentPublished',
        result: {
          hash: '0x999888777',
          destination: '1',
          creator: 'creator_hex',
          prover: 'prover_hex',
          rewardDeadline: '1234567890',
          nativeAmount: '1000000000000000000',
          rewardTokens: [
            { token: 'token_hex', amount: '5000' },
          ],
          route: 'route_data_hex',
        },
      };

      const result = parseTvmIntentPublished(mockEvent);

      expect(result).toEqual({
        intentHash: '0x999888777',
        destination: 1n,
        creator: '0xcreator_hex',
        prover: '0xprover_hex',
        rewardDeadline: 1234567890n,
        nativeAmount: 1000000000000000000n,
        rewardTokens: mockEvent.result.rewardTokens,
        route: 'route_data_hex',
      });
    });

    it('should handle empty reward tokens', () => {
      const mockEvent = {
        event_name: 'IntentPublished',
        result: {
          hash: '0x111222333',
          destination: '10',
          creator: 'addr1',
          prover: 'addr2',
          rewardDeadline: '9999999999',
          nativeAmount: '0',
          rewardTokens: undefined,
          route: 'empty_route',
        },
      };

      const result = parseTvmIntentPublished(mockEvent);

      expect(result.rewardTokens).toBeUndefined();
      expect(result.nativeAmount).toBe(0n);
    });
  });
});