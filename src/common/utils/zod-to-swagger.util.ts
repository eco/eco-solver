import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { EvmAddressSchema, SvmAddressSchema, TronAddressSchema } from '@/config/schemas';

/**
 * Helper to create a Zod schema with BigInt string transformation and proper OpenAPI metadata
 */
export function zodBigIntString(description?: string) {
  return extendApi(z.union([z.string(), z.number()]).transform(BigInt), {
    type: 'number',
    description: description || 'BigInt value as string for JSON compatibility',
    example: '1000000000000000000',
  });
}

/**
 * Helper to create a hex string schema
 */
export function zodHex(description?: string) {
  return extendApi(z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string'), {
    type: 'string',
    pattern: '^0x[a-fA-F0-9]*$',
    description: description || 'Hex string',
    example: '0x1234567890abcdef',
  });
}

// Helper function to create a BlockchainAddress schema
export function zodBlockchainAddress(description?: string) {
  return extendApi(z.union([EvmAddressSchema, TronAddressSchema, SvmAddressSchema]), {
    type: 'string',
    description: description || 'Blockchain address (EVM or Tron)',
    example: '0x1234567890123456789012345678901234567890',
  });
}
