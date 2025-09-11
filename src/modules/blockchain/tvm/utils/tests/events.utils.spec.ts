// Mock TvmUtilsService
import { TvmEventParser } from '@/modules/blockchain/tvm/utils/tvm-event-parser';

jest.mock('@/modules/blockchain/tvm/utils/tvm-utils', () => ({
  TvmUtilsService: {
    fromHex: jest.fn((hex) => `0x${hex}`),
  },
}));

describe('TVM Event Utils', () => {
  describe('parseTvmIntentFulfilled', () => {
    it('should parse IntentFulfilled event correctly', () => {
      const mockEvent: any = {
        event_name: 'IntentFulfilled',
        transaction_id: 'abc123def456',
        block_number: '12345678',
        result: {
          intentHash: '0x1234567890abcdef',
          claimant: '0xabcdefabcdef',
        },
      };

      const chainId = 1000n; // TVM chain ID
      const result = TvmEventParser.parseTvmIntentFulfilled(chainId, mockEvent);

      expect(result).toEqual({
        intentHash: '0x1234567890abcdef',
        claimant: '0xabcdefabcdef',
        chainId,
        transactionHash: 'abc123def456',
        blockNumber: 12345678n,
      });
    });

    it('should handle event without block number', () => {
      const mockEvent: any = {
        event_name: 'IntentFulfilled',
        transaction_id: 'xyz789',
        result: {
          hash: '0xaaaaaa', // Alternative field name
          claimant: '0xbbbbbb',
        },
      };

      const chainId = 2000n;
      const result = TvmEventParser.parseTvmIntentFulfilled(chainId, mockEvent);

      expect(result).toEqual({
        intentHash: '0xaaaaaa',
        claimant: '0xbbbbbb',
        chainId,
        transactionHash: 'xyz789',
        blockNumber: undefined,
      });
    });
  });
});
