import { z } from 'zod';

import { isValidEthereumAddress } from '@/modules/rhinestone/utils/validation';

/**
 * Rhinestone contract addresses for a specific chain
 */
const RhinestoneContractsSchema = z.object({
  router: z.string().refine((val) => isValidEthereumAddress(val), {
    message: 'Invalid Ethereum address',
  }),
  ecoAdapter: z.string().refine((val) => isValidEthereumAddress(val), {
    message: 'Invalid Ethereum address',
  }),
});

/**
 * Rhinestone chain configuration
 */
const RhinestoneChainSchema = z.object({
  contracts: RhinestoneContractsSchema,
});

/**
 * Rhinestone WebSocket configuration
 */
const RhinestoneWebSocketSchema = z.object({
  /**
   * WebSocket URL (wss:// required)
   */
  url: z.string().url().startsWith('wss://', {
    message: 'WebSocket URL must use secure protocol (wss://)',
  }),

  /**
   * API key for authentication
   */
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),

  /** Enable automatic reconnection @default true */
  reconnect: z.boolean().default(true),

  /** Reconnection interval (ms) @default 5000 */
  reconnectInterval: z.coerce.number().int().positive().default(5000),

  /** Max reconnection attempts @default 10 */
  maxReconnectAttempts: z.coerce.number().int().positive().default(10),

  /** Ping interval (ms) @default 30000 */
  pingInterval: z.coerce.number().int().positive().default(30000),

  /** Hello message timeout (ms) @default 2000 */
  helloTimeout: z.coerce.number().int().positive().default(2000),

  /** Authentication timeout (ms) @default 2000 */
  authTimeout: z.coerce.number().int().positive().default(2000),

  /** TLS handshake timeout (ms) @default 5000 */
  handshakeTimeout: z.coerce.number().int().positive().default(5000),
});

/**
 * Rhinestone configuration schema - follows EVM per-chain pattern
 */
export const RhinestoneSchema = z
  .object({
    websocket: RhinestoneWebSocketSchema,
    chains: z.record(z.coerce.number().int().positive(), RhinestoneChainSchema),
  })
  .optional();

export type RhinestoneConfig = z.infer<typeof RhinestoneSchema>;
export type RhinestoneChainConfig = z.infer<typeof RhinestoneChainSchema>;
export type RhinestoneContractsConfig = z.infer<typeof RhinestoneContractsSchema>;
