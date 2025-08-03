import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Prover chain configuration schema
 */
const ProverChainConfigSchema = z.object({
  chainId: z.union([z.string(), z.number()]),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

/**
 * Prover configuration schema
 */
const ProverConfigSchema = z.object({
  type: z.enum(['hyper', 'metalayer']),
  chainConfigs: z.array(ProverChainConfigSchema),
});

/**
 * Provers configuration schema
 */
export const ProversSchema = z.array(ProverConfigSchema).default([]);

export type ProverConfig = z.infer<typeof ProverConfigSchema>;
export type ProverChainConfig = z.infer<typeof ProverChainConfigSchema>;
export type ProversConfig = z.infer<typeof ProversSchema>;

/**
 * Provers configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const proversConfig = registerAs('provers', () => {
  // Helper function to parse prover configuration from environment variables
  const parseProvers = (): any[] => {
    const provers = [];
    let i = 0;
    
    // Look for PROVERS_0_TYPE, PROVERS_1_TYPE, etc.
    while (process.env[`PROVERS_${i}_TYPE`]) {
      const prover: any = {
        type: process.env[`PROVERS_${i}_TYPE`],
        chainConfigs: [],
      };
      
      // Parse chain configs
      let j = 0;
      while (process.env[`PROVERS_${i}_CHAIN_CONFIGS_${j}_CHAIN_ID`]) {
        const chainConfig: any = {
          chainId: process.env[`PROVERS_${i}_CHAIN_CONFIGS_${j}_CHAIN_ID`],
          contractAddress: process.env[`PROVERS_${i}_CHAIN_CONFIGS_${j}_CONTRACT_ADDRESS`],
        };
        
        // Try to parse chainId as number if possible
        const chainIdNum = parseInt(chainConfig.chainId, 10);
        if (!isNaN(chainIdNum)) {
          chainConfig.chainId = chainIdNum;
        }
        
        prover.chainConfigs.push(chainConfig);
        j++;
      }
      
      provers.push(prover);
      i++;
    }
    
    return provers;
  };
  
  return ProversSchema.parse(parseProvers());
});