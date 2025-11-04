import { keccak256 } from 'viem';

import { decodeAdapterClaim, decodeAdapterFill } from '../decoder';
import { extractIntent } from '../intent-extractor';

import { sampleAction } from './sample-action';

describe('Intent Extractor', () => {
  // Sample claim data from a real Rhinestone RelayerAction
  const sampleClaimData = sampleAction.action.claims[0].call.data;

  const sourceChainId = sampleAction.action.claims[0].call.chainId;
  const fillData = decodeAdapterFill(sampleAction.action.fill.call.data);
  const mockPortal = fillData.route.portal;

  describe('extractIntent', () => {
    it('should extract intent from claim data', () => {
      // Decode claim data
      const claimData = decodeAdapterClaim(sampleClaimData);

      // Compute claim hash
      const claimHash = keccak256(sampleClaimData);

      // Extract intent
      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

      // Verify intent structure
      expect(intent).toBeDefined();
      expect(intent.intentHash).toBeDefined();
      expect(typeof intent.intentHash).toBe('string');
      expect(intent.intentHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should extract correct source and destination chains', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

      expect(intent.sourceChainId).toBe(BigInt(8453)); // Base
      expect(intent.destination).toBe(42161n); // Arbitrum
    });

    it('should extract route information correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

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
      expect(intent.route.portal.toLowerCase()).toMatch(/^0x[a-f0-9]{64}$/);
      expect(intent.route.portal.toLowerCase()).toBe(
        '0x000000000000000000000000399dbd5df04f83103f77a58cba2b7c4d3cdede97',
      );
    });

    it('should extract tokens from tokenOut correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

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

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

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

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

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
        '0x0000000000000000000000005eeb0df30c63390735645a0788a373550ebd5707',
      );

      // Verify prover address is correctly decoded from qualifier
      expect(intent.reward.prover.toLowerCase()).toBe(
        '0x000000000000000000000000101c1d5521dc32115089d02774f5298df13dc71f',
      );
    });

    it('should extract reward tokens from tokenIn correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

      // Should have 1 reward token (USDC on Base)
      expect(intent.reward.tokens).toHaveLength(1);

      const rewardToken = intent.reward.tokens[0];
      expect(rewardToken.token.toLowerCase()).toBe(
        '0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      );
      expect(rewardToken.amount).toBe(83739n);
    });

    it('should compute intent hash correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

      // Intent hash should be deterministic
      expect(intent.intentHash).toBe(
        '0xfc18d09b1fa9eba596aee277b424924a0542a2413de60fddedae368a8e3ce6d3',
      );

      // Running extraction again should produce same hash
      const intent2 = extractIntent(claimData, claimHash, sourceChainId, mockPortal);
      expect(intent2.intentHash).toBe(intent.intentHash);
    });

    it('should handle deadline correctly', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

      // Deadline should be same for route and reward
      expect(intent.route.deadline).toBe(intent.reward.deadline);

      // Deadline should be a bigint timestamp
      expect(typeof intent.route.deadline).toBe('bigint');
      expect(intent.route.deadline).toBe(1762217373n);

      // Should be a reasonable future timestamp (year 2025+)
      const deadlineDate = new Date(Number(intent.route.deadline) * 1000);
      expect(deadlineDate.getFullYear()).toBeGreaterThanOrEqual(2025);
    });

    it('should convert all addresses to UniversalAddress format', () => {
      const claimData = decodeAdapterClaim(sampleClaimData);
      const claimHash = keccak256(sampleClaimData);

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

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

      const intent = extractIntent(claimData, claimHash, sourceChainId, mockPortal);

      // Route tokens should match order.tokenOut
      expect(intent.route.tokens.length).toBe(claimData.order.tokenOut.length);

      // Reward tokens should match order.tokenIn
      expect(intent.reward.tokens.length).toBe(claimData.order.tokenIn.length);
    });
  });
});
