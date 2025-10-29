import { keccak256 } from 'viem';

import { decodeAdapterClaim } from '../decoder';
import { extractIntent } from '../intent-extractor';

describe('Intent Extractor', () => {
  // Sample claim data from a real Rhinestone RelayerAction
  const sampleClaimData =
    '0x0fbb12dc000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014feebabe17996b3346cf80f04a1f072102a90cf0900000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000003bc9280836c0000000000679a258c64d2f20f310e12b64b7375ea6d13ac0000000000000000000000000000000000000000000000000000000000000040c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470000000000000000000000000000000000000000000000000000000000000034000000000000000000000000000000000006efb61d8c9546ff1b500de3f244ea7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000002c441bede0300000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000002a0000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000062b2ac83e0c8666d9be4e75b99c0e96c822d23e1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000bf9b5b917a83f8adac17b0752846d41d8d7b7e17000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000764bb35b1c500000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000720000000000000000000000000931ab732c82d315fadbc223c50e1bfef1222bee600000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000640000000000000000000000000778633920c1bb9f1b88cd24e6bca2912cd88e1de000000000000000000000000778633920c1bb9f1b88cd24e6bca2912cd88e1de0cad231ac22bf8d20464732b44d3dbe07c4c1b1170e4dd579d3e000000000000000000000000000000000000000000000000000000000000000000006902845a000000000000000000000000000000000000000000000000000000006902845a0000000000000000000000000000000000000000000000000000000000002105000000000000000000000000000000000000000000000000000000000000a4b100000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000005a00000000000000000000000000000000000000000000000000000000000000001603f2cff710fb6284c7985d1833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000f6cb0000000000000000000000000000000000000000000000000000000000000001603f2cff710fb6284c7985d1af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000c350000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001420304000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000000000000022d473030f116ddee9f6b43ac78ba3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001420304000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000062b2ac83e0c8666d9be4e75b99c0e96c822d23e1000000000000000000000000000000000000000000000000000000000000c350000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014101c1d5521dc32115089d02774f5298df13dc71f000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000550000000000000000000000000000000000000000ad35394ccae6f1c1ee2e4be70e5e75ac87e6974356f0d61efc10b2a8054e09b1622f73b66e5ca151f101c90af59a9c74e8d37d362d417a90a88d359c41da78cb1b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as const;

  const sourceChainId = 8453; // Base

  describe('extractIntent', () => {
    it('should extract intent from claim data', () => {
      // Decode claim data
      const claimData = decodeAdapterClaim(sampleClaimData);

      // Compute claim hash
      const claimHash = keccak256(sampleClaimData);

      // Extract intent
      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Verify intent structure
      expect(intent).toBeDefined();
      expect(intent.intentHash).toBeDefined();
      expect(typeof intent.intentHash).toBe('string');
      expect(intent.intentHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should extract correct source and destination chains', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      expect(intent.sourceChainId).toBe(BigInt(8453)); // Base
      expect(intent.destination).toBe(42161n); // Arbitrum
    });

    it('should extract route information correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Verify route structure
      expect(intent.route).toBeDefined();
      expect(intent.route.salt).toBeDefined();
      expect(intent.route.deadline).toBeDefined();
      expect(intent.route.portal).toBeDefined();
      expect(intent.route.nativeAmount).toBe(0n);
      expect(Array.isArray(intent.route.tokens)).toBe(true);
      expect(Array.isArray(intent.route.calls)).toBe(true);

      // Verify salt is a 32-byte hex string
      expect(intent.route.salt).toMatch(/^0x[a-f0-9]{64}$/);

      // Verify portal is UniversalAddress (32-byte hex)
      expect(intent.route.portal).toMatch(/^0x[a-f0-9]{64}$/);
      expect(intent.route.portal).toBe(
        '0x000000000000000000000000101c1d5521dc32115089d02774f5298df13dc71f',
      );
    });

    it('should extract tokens from tokenOut correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Should have 1 token (USDC on Arbitrum)
      expect(intent.route.tokens).toHaveLength(1);

      const token = intent.route.tokens[0];
      expect(token.token.toLowerCase()).toBe(
        '0x000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831',
      );
      expect(token.amount).toBe(50000n);
    });

    it('should extract calls correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Should have at least 1 call (token transfer)
      expect(intent.route.calls.length).toBeGreaterThanOrEqual(1);

      const firstCall = intent.route.calls[0];
      expect(firstCall.target).toBeDefined();
      expect(firstCall.value).toBeDefined();
      expect(firstCall.data).toBeDefined();

      // Verify call target is UniversalAddress (66 chars)
      expect(firstCall.target.length).toBe(66);
      expect(firstCall.target.toLowerCase()).toMatch(/^0x[a-f0-9]{64}$/);

      // First call should be ERC20 transfer
      expect(firstCall.data).toContain('a9059cbb'); // transfer selector
    });

    it('should extract reward information correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Verify reward structure
      expect(intent.reward).toBeDefined();
      expect(intent.reward.deadline).toBeDefined();
      expect(intent.reward.creator).toBeDefined();
      expect(intent.reward.prover).toBeDefined();
      expect(intent.reward.nativeAmount).toBe(0n);
      expect(Array.isArray(intent.reward.tokens)).toBe(true);

      // Verify addresses are UniversalAddress format (66 chars)
      expect(intent.reward.creator.length).toBe(66);
      expect(intent.reward.prover.length).toBe(66);
      expect(intent.reward.creator.toLowerCase()).toMatch(/^0x[a-f0-9]{64}$/);
      expect(intent.reward.prover.toLowerCase()).toMatch(/^0x[a-f0-9]{64}$/);

      expect(intent.reward.creator.toLowerCase()).toBe(
        '0x000000000000000000000000778633920c1bb9f1b88cd24e6bca2912cd88e1de',
      );
    });

    it('should extract reward tokens from tokenIn correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Should have 1 reward token (USDC on Base)
      expect(intent.reward.tokens).toHaveLength(1);

      const rewardToken = intent.reward.tokens[0];
      expect(rewardToken.token.toLowerCase()).toBe(
        '0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      );
      expect(rewardToken.amount).toBe(63179n);
    });

    it('should compute intent hash correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Intent hash should be deterministic
      expect(intent.intentHash).toBe(
        '0x1d434946a1dcb741a6cdada2f312662d89c9f5c734f0f28c37595fde42eeac05',
      );

      // Running extraction again should produce same hash
      const intent2 = extractIntent(claimData, claimHash, sourceChainId);
      expect(intent2.intentHash).toBe(intent.intentHash);
    });

    it('should handle deadline correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Deadline should be same for route and reward
      expect(intent.route.deadline).toBe(intent.reward.deadline);

      // Deadline should be a bigint timestamp
      expect(typeof intent.route.deadline).toBe('bigint');
      expect(intent.route.deadline).toBe(1761772634n);

      // Should be a reasonable future timestamp (year 2025+)
      const deadlineDate = new Date(Number(intent.route.deadline) * 1000);
      expect(deadlineDate.getFullYear()).toBeGreaterThanOrEqual(2025);
    });

    it('should convert all addresses to UniversalAddress format', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // All addresses should be 32 bytes (66 chars including 0x)
      expect(intent.route.portal.length).toBe(66);
      expect(intent.reward.creator.length).toBe(66);
      expect(intent.reward.prover.length).toBe(66);

      intent.route.tokens.forEach((token) => {
        expect(token.token.length).toBe(66);
      });

      intent.route.calls.forEach((call) => {
        expect(call.target.length).toBe(66);
      });

      intent.reward.tokens.forEach((token) => {
        expect(token.token.length).toBe(66);
      });
    });

    it('should have matching token count with order data', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId);

      // Route tokens should match order.tokenOut
      expect(intent.route.tokens.length).toBe(claimData.order.tokenOut.length);

      // Reward tokens should match order.tokenIn
      expect(intent.reward.tokens.length).toBe(claimData.order.tokenIn.length);
    });
  });
});
