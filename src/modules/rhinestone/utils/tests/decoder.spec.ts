import { decodeAdapterClaim } from '../decoder';

import { sampleAction } from './sample-action';

describe('Decoder', () => {
  describe('decodeAdapterClaim', () => {
    it('should decode claim calldata with optimized format (eco_permit2_handleClaim_optimized)', () => {
      const claimData = sampleAction.action.claims[0].call.data;

      const result = decodeAdapterClaim(claimData);

      // Verify claim data structure
      expect(result).toBeDefined();
      expect(result.predictedVault).toBeDefined();
      expect(result.order).toBeDefined();
      expect(result.userSigs).toBeDefined();

      // Verify order fields match expected values from sample data
      const order = result.order;
      expect(order.sponsor).toBe('0x778633920C1bb9F1B88CD24E6bCA2912cd88E1de');
      expect(order.recipient).toBe('0x778633920C1bb9F1B88CD24E6bCA2912cd88E1de');
      expect(order.notarizedChainId).toBe(8453n); // Base
      expect(order.targetChainId).toBe(42161n); // Arbitrum
      expect(order.fillDeadline).toBeDefined();
      expect(order.expires).toBeDefined();

      // Verify tokens - should be in uint256[2][] format
      expect(order.tokenIn).toBeDefined();
      expect(order.tokenIn.length).toBeGreaterThan(0);
      expect(Array.isArray(order.tokenIn[0])).toBe(true);
      expect(order.tokenIn[0].length).toBe(2); // [tokenId, amount]

      expect(order.tokenOut).toBeDefined();
      expect(order.tokenOut.length).toBeGreaterThan(0);
      expect(Array.isArray(order.tokenOut[0])).toBe(true);
      expect(order.tokenOut[0].length).toBe(2); // [tokenId, amount]

      // Verify token amounts match metadata
      const [tokenInId, tokenInAmount] = order.tokenIn[0];
      const [tokenOutId, tokenOutAmount] = order.tokenOut[0];

      // Extract token addresses from lower 160 bits
      const tokenInAddress = `0x${tokenInId.toString(16).padStart(40, '0').slice(-40)}`;
      const tokenOutAddress = `0x${tokenOutId.toString(16).padStart(40, '0').slice(-40)}`;

      expect(tokenInAddress.toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'); // USDC on Base
      expect(tokenInAmount).toBe(80657n);

      expect(tokenOutAddress.toLowerCase()).toBe('0xaf88d065e77c8cc2239327c5edb3a432268e5831'); // USDC on Arbitrum
      expect(tokenOutAmount).toBe(50000n);

      // Verify operations
      expect(order.preClaimOps).toBeDefined();
      expect(order.targetOps).toBeDefined();
      expect(order.qualifier).toBeDefined();

      // Verify signatures
      expect(result.userSigs.notarizedClaimSig).toBeDefined();
      expect(result.userSigs.preClaimSig).toBeDefined();
    });

    it('should throw error for invalid function', () => {
      const invalidData = '0x12345678' as const;
      expect(() => decodeAdapterClaim(invalidData)).toThrow();
    });
  });
});
