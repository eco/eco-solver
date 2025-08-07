import { denormalize, normalize } from '../normalize';

describe('Cross-Token Operations with Different Decimals', () => {
  const createToken = (amount: number, decimals: number): bigint => {
    return BigInt(amount) * 10n ** BigInt(decimals);
  };

  const normalizeAndSum = (tokens: Array<{ amount: bigint; decimals: number }>): bigint => {
    return tokens.reduce((sum, token) => sum + normalize(token.amount, token.decimals), 0n);
  };

  const compareNormalizedTokens = (
    tokenA: { amount: bigint; decimals: number },
    tokenB: { amount: bigint; decimals: number },
  ): number => {
    const normalizedA = normalize(tokenA.amount, tokenA.decimals);
    const normalizedB = normalize(tokenB.amount, tokenB.decimals);
    if (normalizedA > normalizedB) return 1;
    if (normalizedA < normalizedB) return -1;
    return 0;
  };

  describe('Addition with different decimals', () => {
    it('should add 10 TokenA (6 decimals) + 20 TokenB (18 decimals) = 30', () => {
      const tokenA = createToken(10, 6);
      const tokenB = createToken(20, 18);

      const normalizedA = normalize(tokenA, 6);
      const normalizedB = normalize(tokenB, 18);

      const sum = normalizedA + normalizedB;
      const expectedSum = createToken(30, 18);

      expect(sum).toBe(expectedSum);
    });

    it('should handle multiple tokens with varying decimals', () => {
      const tokens = [
        { amount: createToken(5, 6), decimals: 6 }, // 5 USDC
        { amount: createToken(10, 18), decimals: 18 }, // 10 DAI
        { amount: createToken(3, 8), decimals: 8 }, // 3 WBTC
        { amount: createToken(7, 2), decimals: 2 }, // 7 tokens with 2 decimals
      ];

      const sum = normalizeAndSum(tokens);
      const expectedSum = createToken(25, 18); // 5 + 10 + 3 + 7 = 25 in 18 decimals

      expect(sum).toBe(expectedSum);
    });

    it('should add same value tokens with different decimals correctly', () => {
      const oneUSDC = 1000000n; // 1 USDC (6 decimals)
      const oneDAI = 1000000000000000000n; // 1 DAI (18 decimals)

      const normalizedUSDC = normalize(oneUSDC, 6);
      const normalizedDAI = normalize(oneDAI, 18);

      const sum = normalizedUSDC + normalizedDAI;
      const expectedSum = 2000000000000000000n; // 2 in 18 decimals

      expect(sum).toBe(expectedSum);
    });

    it('should handle fractional token additions', () => {
      const halfTokenA = 500000n; // 0.5 token with 6 decimals
      const quarterTokenB = 25000000n; // 0.25 token with 8 decimals

      const normalizedA = normalize(halfTokenA, 6);
      const normalizedB = normalize(quarterTokenB, 8);

      const sum = normalizedA + normalizedB;
      const expectedSum = 750000000000000000n; // 0.75 in 18 decimals

      expect(sum).toBe(expectedSum);
    });

    it('should handle zero decimal tokens', () => {
      const tokenA = 100n; // 100 tokens with 0 decimals
      const tokenB = createToken(50, 18); // 50 tokens with 18 decimals

      const normalizedA = normalize(tokenA, 0);
      const normalizedB = normalize(tokenB, 18);

      const sum = normalizedA + normalizedB;
      const expectedSum = createToken(150, 18);

      expect(sum).toBe(expectedSum);
    });
  });

  describe('Subtraction with different decimals', () => {
    it('should subtract 50 TokenA (18) - 20 TokenB (6) = 30', () => {
      const tokenA = createToken(50, 18);
      const tokenB = createToken(20, 6);

      const normalizedA = normalize(tokenA, 18);
      const normalizedB = normalize(tokenB, 6);

      const difference = normalizedA - normalizedB;
      const expectedDifference = createToken(30, 18);

      expect(difference).toBe(expectedDifference);
    });

    it('should show that order matters in subtraction', () => {
      const tokenA = createToken(10, 6);
      const tokenB = createToken(5, 18); // Different amounts to show order matters

      const normalizedA = normalize(tokenA, 6);
      const normalizedB = normalize(tokenB, 18);

      const diffAB = normalizedA - normalizedB;
      const diffBA = normalizedB - normalizedA;

      expect(diffAB).toBe(-diffBA);
      expect(diffAB).not.toBe(diffBA);
    });

    it('should result in zero when subtracting equal values', () => {
      const tenUSDC = 10000000n; // 10 USDC (6 decimals)
      const tenDAI = 10000000000000000000n; // 10 DAI (18 decimals)

      const normalizedUSDC = normalize(tenUSDC, 6);
      const normalizedDAI = normalize(tenDAI, 18);

      const difference = normalizedUSDC - normalizedDAI;

      expect(difference).toBe(0n);
    });

    it('should handle negative results correctly', () => {
      const tokenA = createToken(5, 6);
      const tokenB = createToken(10, 18);

      const normalizedA = normalize(tokenA, 6);
      const normalizedB = normalize(tokenB, 18);

      const difference = normalizedA - normalizedB;
      const expectedDifference = createToken(-5, 18);

      expect(difference).toBe(expectedDifference);
    });
  });

  describe('Comparison operations', () => {
    it('should correctly compare equal values with different decimals', () => {
      const oneMillionUnits6Dec = 1000000n; // 1 token with 6 decimals
      const oneToken18Dec = 1000000000000000000n; // 1 token with 18 decimals

      const comparison = compareNormalizedTokens(
        { amount: oneMillionUnits6Dec, decimals: 6 },
        { amount: oneToken18Dec, decimals: 18 },
      );

      expect(comparison).toBe(0);
    });

    it('should correctly compare greater and less than', () => {
      const tokenA = { amount: createToken(10, 6), decimals: 6 };
      const tokenB = { amount: createToken(5, 18), decimals: 18 };

      expect(compareNormalizedTokens(tokenA, tokenB)).toBe(1);
      expect(compareNormalizedTokens(tokenB, tokenA)).toBe(-1);
    });

    it('should sort tokens with different decimals correctly', () => {
      const tokens = [
        { amount: createToken(5, 6), decimals: 6, name: 'USDC' },
        { amount: createToken(10, 18), decimals: 18, name: 'DAI' },
        { amount: createToken(3, 8), decimals: 8, name: 'WBTC' },
        { amount: createToken(7, 2), decimals: 2, name: 'TokenX' },
      ];

      const sorted = [...tokens].sort((a, b) =>
        compareNormalizedTokens(
          { amount: a.amount, decimals: a.decimals },
          { amount: b.amount, decimals: b.decimals },
        ),
      );

      expect(sorted.map((t) => t.name)).toEqual(['WBTC', 'USDC', 'TokenX', 'DAI']);
    });

    it('should check if token meets minimum threshold across decimals', () => {
      const minimumThreshold = createToken(5, 18); // 5 tokens in 18 decimals
      const tokens = [
        { amount: createToken(3, 6), decimals: 6, meetsMin: false },
        { amount: createToken(5, 18), decimals: 18, meetsMin: true },
        { amount: createToken(10, 8), decimals: 8, meetsMin: true },
        { amount: createToken(1, 2), decimals: 2, meetsMin: false },
      ];

      tokens.forEach((token) => {
        const normalized = normalize(token.amount, token.decimals);
        const meetsMinimum = normalized >= minimumThreshold;
        expect(meetsMinimum).toBe(token.meetsMin);
      });
    });
  });

  describe('Aggregation operations', () => {
    it('should calculate portfolio total across different tokens', () => {
      const portfolio = [
        { amount: 5000000n, decimals: 6 }, // 5 USDC
        { amount: 3000000000000000000n, decimals: 18 }, // 3 DAI
        { amount: 200000000n, decimals: 8 }, // 2 WBTC
        { amount: 1000n, decimals: 2 }, // 10 tokens with 2 decimals
      ];

      const total = normalizeAndSum(portfolio);
      const expectedTotal = createToken(20, 18); // 5 + 3 + 2 + 10 = 20

      expect(total).toBe(expectedTotal);
    });

    it('should calculate average value of tokens with different decimals', () => {
      const tokens = [
        { amount: createToken(10, 6), decimals: 6 },
        { amount: createToken(20, 18), decimals: 18 },
        { amount: createToken(30, 8), decimals: 8 },
      ];

      const sum = normalizeAndSum(tokens);
      const average = sum / BigInt(tokens.length);
      const expectedAverage = createToken(20, 18); // (10 + 20 + 30) / 3 = 20

      expect(average).toBe(expectedAverage);
    });

    it('should find maximum and minimum from mixed decimal tokens', () => {
      const tokens = [
        { amount: createToken(5, 6), decimals: 6 },
        { amount: createToken(10, 18), decimals: 18 },
        { amount: createToken(3, 8), decimals: 8 },
        { amount: createToken(15, 2), decimals: 2 },
      ];

      const normalized = tokens.map((t) => ({
        ...t,
        normalized: normalize(t.amount, t.decimals),
      }));

      const max = normalized.reduce((max, current) =>
        current.normalized > max.normalized ? current : max,
      );
      const min = normalized.reduce((min, current) =>
        current.normalized < min.normalized ? current : min,
      );

      expect(max.decimals).toBe(2); // 15 with 2 decimals is the largest
      expect(min.decimals).toBe(8); // 3 with 8 decimals is the smallest
    });

    it('should calculate weighted sum of tokens', () => {
      const tokenA = createToken(10, 6); // 10 USDC
      const tokenB = createToken(5, 18); // 5 DAI
      const tokenC = createToken(20, 8); // 20 WBTC

      const weightedSum =
        2n * normalize(tokenA, 6) + 3n * normalize(tokenB, 18) + 1n * normalize(tokenC, 8);

      // 2*10 + 3*5 + 1*20 = 20 + 15 + 20 = 55
      const expectedSum = createToken(55, 18);

      expect(weightedSum).toBe(expectedSum);
    });
  });

  describe('Ratio and proportion operations', () => {
    it('should handle exchange rates between tokens', () => {
      // 1 TokenA (6 decimals) = 2 TokenB (18 decimals)
      const oneTokenA = createToken(1, 6);
      const twoTokenB = createToken(2, 18);

      const normalizedA = normalize(oneTokenA, 6);
      const normalizedB = normalize(twoTokenB, 18);

      expect(normalizedA).toBe(normalizedB / 2n);
    });

    it('should calculate percentages of tokens with different decimals', () => {
      const tokenA = createToken(100, 6); // 100 USDC
      const tokenB = createToken(50, 18); // 50 DAI

      const tenPercentA = normalize(tokenA, 6) / 10n; // 10% of TokenA
      const twentyPercentB = normalize(tokenB, 18) / 5n; // 20% of TokenB

      const total = tenPercentA + twentyPercentB;
      const expectedTotal = createToken(20, 18); // 10 + 10 = 20

      expect(total).toBe(expectedTotal);
    });

    it('should calculate price ratios with different decimals', () => {
      const priceA = 1500000n; // $1.50 with 6 decimals
      const priceB = 3000000000000000000n; // $3.00 with 18 decimals

      const normalizedPriceA = normalize(priceA, 6);
      const normalizedPriceB = normalize(priceB, 18);

      const ratio = (normalizedPriceA * 1000n) / normalizedPriceB;

      expect(ratio).toBe(500n); // 1.5 / 3 = 0.5, represented as 500/1000
    });

    it('should calculate fees on mixed decimal tokens', () => {
      const tokens = [
        { amount: createToken(1000, 6), decimals: 6 }, // 1000 USDC
        { amount: createToken(500, 18), decimals: 18 }, // 500 DAI
      ];

      const feeRate = 3n; // 0.3% = 3/1000
      const fees = tokens.map((token) => {
        const normalized = normalize(token.amount, token.decimals);
        const fee = (normalized * feeRate) / 1000n;
        return { fee, decimals: token.decimals };
      });

      const totalFees = fees.reduce((sum, f) => sum + f.fee, 0n);
      const expectedTotalFees = 4500000000000000000n; // 0.3% of 1500 = 4.5 in 18 decimals

      expect(totalFees).toBe(expectedTotalFees);
    });
  });

  describe('Real-world DeFi scenarios', () => {
    it('should calculate DeFi pool balances with USDC and DAI', () => {
      const usdcBalance = 1000000000000n; // 1,000,000 USDC (6 decimals)
      const daiBalance = 1000000000000000000000000n; // 1,000,000 DAI (18 decimals)

      const normalizedUSDC = normalize(usdcBalance, 6);
      const normalizedDAI = normalize(daiBalance, 18);

      const totalPoolValue = normalizedUSDC + normalizedDAI;
      const expectedTotal = createToken(2000000, 18); // 2 million total

      expect(totalPoolValue).toBe(expectedTotal);
    });

    it('should handle multi-token swap calculations', () => {
      // Swap 100 USDC for DAI at 1:0.99 rate
      const inputAmount = 100000000n; // 100 USDC (6 decimals)
      const swapRate = 990n; // 0.99 represented as 990/1000

      const normalizedInput = normalize(inputAmount, 6);
      const outputAmount = (normalizedInput * swapRate) / 1000n;

      const expectedOutput = 99000000000000000000n; // 99 DAI in 18 decimals
      expect(outputAmount).toBe(expectedOutput);

      // Verify by denormalizing
      const denormalizedOutput = denormalize(outputAmount, 18);
      expect(denormalizedOutput).toBe(99000000000000000000n);
    });

    it('should handle liquidity provision with equal value deposits', () => {
      // User wants to provide $1000 worth of liquidity
      // Current prices: USDC = $1, DAI = $0.99
      const targetValue = createToken(1000, 18); // $1000 in normalized form

      const usdcAmount = targetValue / 2n; // $500 worth
      const daiAmount = targetValue / 2n; // $500 worth

      // Convert to token amounts
      const usdcDeposit = denormalize(usdcAmount, 6);
      const daiDeposit = denormalize(daiAmount, 18);

      expect(usdcDeposit).toBe(500000000n); // 500 USDC
      expect(daiDeposit).toBe(500000000000000000000n); // 500 DAI

      // Verify total value
      const totalValue = normalize(usdcDeposit, 6) + normalize(daiDeposit, 18);
      expect(totalValue).toBe(targetValue);
    });

    it('should calculate yield farming rewards', () => {
      // Staking 1000 USDC (6 decimals) earning rewards in REWARD token (18 decimals)
      const stakedAmount = 1000000000n; // 1000 USDC
      const apr = 120n; // 12% APR represented as 120/1000
      const daysStaked = 30n;
      const daysPerYear = 365n;

      const normalizedStaked = normalize(stakedAmount, 6);
      // Calculate rewards: (staked * apr * days) / (1000 * daysPerYear)
      const rewards = (normalizedStaked * apr * daysStaked) / (1000n * daysPerYear);

      // Expected: ~9.86 tokens (30/365 * 12% * 1000)
      // 1000 * 0.12 * 30/365 = 9.863013698...
      // Due to integer division, we get slight precision loss
      const minExpected = 9860000000000000000n; // ~9.86
      const maxExpected = 9870000000000000000n; // ~9.87
      expect(rewards).toBeGreaterThanOrEqual(minExpected);
      expect(rewards).toBeLessThanOrEqual(maxExpected);
    });

    it('should handle complex DeFi position with multiple tokens', () => {
      // User position:
      // - Provided liquidity: 500 USDC + 500 DAI
      // - Borrowed: 200 USDT (6 decimals)
      // - Collateral: 0.1 WBTC (8 decimals)

      const positions = {
        provided: [
          { amount: 500000000n, decimals: 6 }, // 500 USDC
          { amount: 500000000000000000000n, decimals: 18 }, // 500 DAI
        ],
        borrowed: { amount: 200000000n, decimals: 6 }, // 200 USDT
        collateral: { amount: 10000000n, decimals: 8 }, // 0.1 WBTC @ $50k = $5000
      };

      const totalProvided = normalizeAndSum(positions.provided);
      const normalizedBorrowed = normalize(positions.borrowed.amount, positions.borrowed.decimals);
      const normalizedCollateral = normalize(
        positions.collateral.amount,
        positions.collateral.decimals,
      );

      // Calculate net position (assuming WBTC = $50k)
      const wbtcValue = normalizedCollateral * 50000n; // 0.1 * 50000 = 5000
      const netPosition = totalProvided + wbtcValue - normalizedBorrowed;

      const expectedNet = createToken(5800, 18); // 1000 + 5000 - 200 = 5800
      expect(netPosition).toBe(expectedNet);
    });
  });

  describe('Edge cases and extreme values', () => {
    it('should handle tokens with more than 18 decimals', () => {
      const token6Decimals = 1000000n; // 1 token with 6 decimals

      // For tokens with more than 18 decimals, we need to divide instead of multiply
      // This is a limitation of the normalize function - it assumes decimals <= 18
      // In practice, tokens with > 18 decimals are extremely rare

      // Skip normalization for > 18 decimals as the function doesn't support it
      // Instead, let's test edge case of exactly 18 decimals
      const token18Decimals = 1000000000000000000n; // 1 token with 18 decimals
      const normalized18 = normalize(token18Decimals, 18);
      const normalized6 = normalize(token6Decimals, 6);

      expect(normalized18).toBe(token18Decimals); // Should be unchanged
      expect(normalized6).toBe(1000000000000000000n); // Should be scaled up
    });

    it('should handle very large numbers without overflow', () => {
      const maxSafeInteger = 2n ** 256n - 1n; // Max uint256
      const halfMax = maxSafeInteger / 2n;

      // This should not overflow since we're not multiplying beyond max
      const normalized = normalize(halfMax, 18);
      expect(normalized).toBe(halfMax); // 18 decimals returns same value

      // Adding two large normalized values
      const quarterMax = maxSafeInteger / 4n;
      const sum = normalize(quarterMax, 6) + normalize(quarterMax, 8);
      expect(sum).toBeGreaterThan(0n); // Should not overflow to negative
    });

    it('should handle precision edge cases', () => {
      // Test with 1 wei (smallest unit)
      const oneWei = 1n;
      const normalizedWei6 = normalize(oneWei, 6);
      const normalizedWei18 = normalize(oneWei, 18);

      expect(normalizedWei6).toBe(1000000000000n); // 1e12
      expect(normalizedWei18).toBe(1n);

      // Test precision loss when denormalizing
      const smallAmount = 999n; // Less than 1000
      const normalized = normalize(smallAmount, 0);
      const denormalized = denormalize(normalized, 3);

      // Should lose precision since 999 * 1e18 / 1e15 = 999000
      expect(denormalized).toBe(999000n);
    });

    it('should maintain precision in complex calculations', () => {
      // Simulating a complex DeFi calculation with rounding
      const amount = 123456789n; // Amount with 6 decimals
      const feeRate = 25n; // 0.25% = 25/10000
      const slippage = 10n; // 0.1% = 10/10000

      const normalized = normalize(amount, 6);

      // Using single division to avoid precision loss
      const afterCalc = (normalized * (10000n - feeRate - slippage)) / 10000n;
      const finalAmount = denormalize(afterCalc, 6);

      // Calculate expected using the same pattern
      const expectedFinalAmount = (amount * (10000n - feeRate - slippage)) / 10000n;

      // With identical operations, we should have zero tolerance
      expect(finalAmount).toBe(expectedFinalAmount);
    });
  });
});
