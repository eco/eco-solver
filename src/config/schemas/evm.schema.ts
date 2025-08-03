import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * EVM network RPC configuration schema
 */
const EvmRpcSchema = z.object({
  urls: z.array(z.string().url()),
  options: z
    .object({
      batch: z
        .union([
          z.boolean(),
          z.object({
            multicall: z.boolean().optional(),
            batchSize: z.number().int().positive().optional(),
            wait: z.number().int().positive().optional(),
          }),
        ])
        .optional(),
      timeout: z.number().int().positive().optional(),
      retryCount: z.number().int().min(0).optional(),
      retryDelay: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * EVM network WebSocket configuration schema
 */
const EvmWsSchema = z.object({
  urls: z.array(
    z
      .string()
      .url()
      .or(z.string().regex(/^wss?:/)),
  ),
  options: z
    .object({
      timeout: z.number().int().positive().optional(),
      keepAlive: z.boolean().optional(),
      reconnect: z
        .union([
          z.boolean(),
          z.object({
            auto: z.boolean().optional(),
            delay: z.number().int().positive().optional(),
            maxAttempts: z.number().int().positive().optional(),
          }),
        ])
        .optional(),
    })
    .optional(),
});

/**
 * EVM token configuration schema
 */
const EvmTokenSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().int().min(0).max(18),
  limit: z.string(), // Using string for bigint compatibility
});

/**
 * EVM fee logic configuration schema
 */
const EvmFeeLogicSchema = z.object({
  baseFlatFee: z.string(), // Using string for bigint compatibility (in wei)
  scalarBps: z.number().int().min(0).max(10000), // Basis points (0-10000 = 0-100%)
});

/**
 * EVM network configuration schema
 */
const EvmNetworkSchema = z.object({
  chainId: z.number().int().positive(),
  rpc: EvmRpcSchema,
  ws: EvmWsSchema.optional(),
  intentSourceAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  inboxAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokens: z.array(EvmTokenSchema).default([]),
  feeLogic: EvmFeeLogicSchema,
});

/**
 * EVM configuration schema
 */
export const EvmSchema = z.object({
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  networks: z.array(EvmNetworkSchema).default([]),
});

export type EvmConfig = z.infer<typeof EvmSchema>;
export type EvmNetworkConfig = z.infer<typeof EvmNetworkSchema>;
export type EvmTokenConfig = z.infer<typeof EvmTokenSchema>;
export type EvmFeeLogicConfig = z.infer<typeof EvmFeeLogicSchema>;

/**
 * EVM configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const evmConfig = registerAs('evm', () => {
  // Helper function to parse network configuration from environment variables
  const parseNetworks = (): any[] => {
    const networks = [];
    let i = 0;
    
    // Look for EVM_NETWORKS_0_CHAIN_ID, EVM_NETWORKS_1_CHAIN_ID, etc.
    while (process.env[`EVM_NETWORKS_${i}_CHAIN_ID`]) {
      const network: any = {
        chainId: parseInt(process.env[`EVM_NETWORKS_${i}_CHAIN_ID`], 10),
        rpc: {
          urls: [],
        },
        tokens: [],
        feeLogic: {},
      };
      
      // Parse RPC URLs
      let j = 0;
      while (process.env[`EVM_NETWORKS_${i}_RPC_URLS_${j}`]) {
        network.rpc.urls.push(process.env[`EVM_NETWORKS_${i}_RPC_URLS_${j}`]);
        j++;
      }
      
      // Parse WebSocket URLs if present
      j = 0;
      if (process.env[`EVM_NETWORKS_${i}_WS_URLS_0`]) {
        network.ws = { urls: [] };
        while (process.env[`EVM_NETWORKS_${i}_WS_URLS_${j}`]) {
          network.ws.urls.push(process.env[`EVM_NETWORKS_${i}_WS_URLS_${j}`]);
          j++;
        }
      }
      
      // Parse addresses
      if (process.env[`EVM_NETWORKS_${i}_INTENT_SOURCE_ADDRESS`]) {
        network.intentSourceAddress = process.env[`EVM_NETWORKS_${i}_INTENT_SOURCE_ADDRESS`];
      }
      if (process.env[`EVM_NETWORKS_${i}_INBOX_ADDRESS`]) {
        network.inboxAddress = process.env[`EVM_NETWORKS_${i}_INBOX_ADDRESS`];
      }
      
      // Parse fee logic
      if (process.env[`EVM_NETWORKS_${i}_FEE_LOGIC_BASE_FLAT_FEE`]) {
        network.feeLogic.baseFlatFee = process.env[`EVM_NETWORKS_${i}_FEE_LOGIC_BASE_FLAT_FEE`];
      }
      if (process.env[`EVM_NETWORKS_${i}_FEE_LOGIC_SCALAR_BPS`]) {
        network.feeLogic.scalarBps = parseInt(process.env[`EVM_NETWORKS_${i}_FEE_LOGIC_SCALAR_BPS`], 10);
      }
      
      // Parse tokens
      j = 0;
      while (process.env[`EVM_NETWORKS_${i}_TOKENS_${j}_ADDRESS`]) {
        const token: any = {
          address: process.env[`EVM_NETWORKS_${i}_TOKENS_${j}_ADDRESS`],
        };
        if (process.env[`EVM_NETWORKS_${i}_TOKENS_${j}_DECIMALS`]) {
          token.decimals = parseInt(process.env[`EVM_NETWORKS_${i}_TOKENS_${j}_DECIMALS`], 10);
        }
        if (process.env[`EVM_NETWORKS_${i}_TOKENS_${j}_LIMIT`]) {
          token.limit = process.env[`EVM_NETWORKS_${i}_TOKENS_${j}_LIMIT`];
        }
        network.tokens.push(token);
        j++;
      }
      
      networks.push(network);
      i++;
    }
    
    return networks;
  };
  
  return EvmSchema.parse({
    privateKey: process.env.EVM_PRIVATE_KEY,
    walletAddress: process.env.EVM_WALLET_ADDRESS,
    networks: parseNetworks(),
  });
});