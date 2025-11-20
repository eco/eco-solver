import { z } from 'zod';

/**
 * CCIP Chain Selectors configuration
 * Maps standard chain IDs to CCIP-specific chain selectors
 */
const ChainSelectorsSchema = z
  .record(
    z.coerce.string(), // Chain ID as string key (will be transformed to number)
    z.string(), // CCIP selector as string value
  )
  .default({
    '1': '5009297550715157269', // Ethereum Mainnet
    '2020': '6916147374840168594', // Ronin
    '8453': '15971525489660198786', // Base
  })
  .transform((value) => {
    // Transform to Record<number, string> for easier lookup by numeric chainId
    const result: Record<number, string> = {};
    for (const [chainId, selector] of Object.entries(value)) {
      const numericChainId = parseInt(chainId, 10);
      if (isNaN(numericChainId)) {
        throw new Error(`Invalid chain ID in chainSelectors: ${chainId}`);
      }
      result[numericChainId] = selector;
    }
    return result;
  });

/**
 * CCIP Prover configuration
 */
const CcipProverConfigSchema = z
  .object({
    gasLimit: z.number().int().positive().default(300000),
    allowOutOfOrderExecution: z.boolean().default(true),
    deadlineBuffer: z.number().int().positive().default(7200), // 2 hours in seconds
    chainSelectors: ChainSelectorsSchema,
  })
  .default({});

/**
 * Provers configuration schema
 * Contains prover-specific configuration that applies globally across all chains
 */
export const ProversSchema = z
  .object({
    ccip: CcipProverConfigSchema,
  })
  .default({});

export type ProversConfig = z.infer<typeof ProversSchema>;
export type CcipProverConfig = z.infer<typeof CcipProverConfigSchema>;
export type ChainSelectors = z.infer<typeof ChainSelectorsSchema>;
