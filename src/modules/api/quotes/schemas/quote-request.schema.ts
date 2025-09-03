import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { EvmAddressSchema, TronAddressSchema } from '@/config/schemas';

// Helper function to create a BlockchainAddress schema
function zodBlockchainAddress(description?: string) {
  return extendApi(z.union([EvmAddressSchema, TronAddressSchema]), {
    type: 'string',
    description: description || 'Blockchain address (EVM or Tron)',
    example: '0x1234567890123456789012345678901234567890',
  });
}

// Inner quote request schema
const QuoteRequestInnerSchema = extendApi(
  z.object({
    sourceChainID: extendApi(z.number().transform(BigInt), {
      description: 'Source chain ID',
      example: 1,
    }),
    destinationChainID: extendApi(z.number().transform(BigInt), {
      description: 'Destination chain ID',
      example: 10,
    }),
    sourceToken: zodBlockchainAddress('Source token address'),
    destinationToken: zodBlockchainAddress('Destination token address'),
    sourceAmount: extendApi(z.string().transform(BigInt), {
      description: 'Source amount in Wei (as string for BigInt compatibility)',
      example: '1000000000000000000',
    }),
    funder: zodBlockchainAddress('Address funding the swap'),
    recipient: zodBlockchainAddress('Address receiving tokens on destination'),
  }),
  {
    description: 'Quote request details for cross-chain token swap',
  },
);

// Main quote request schema with OpenAPI metadata
export const QuoteRequestSchema = extendApi(
  z.object({
    dAppID: extendApi(z.string(), {
      description: 'Identifier of the requesting dApp',
      example: 'my-dapp-v1',
    }),
    quoteRequest: QuoteRequestInnerSchema,
  }),
  {
    description: 'Request body for getting a quote for a cross-chain token swap',
  },
);

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
