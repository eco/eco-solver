import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodBigIntString, zodBlockchainAddress } from '@/common/utils/zod-to-swagger.util';

// Inner quote request schema
const QuoteRequestInnerSchema = extendApi(
  z.object({
    sourceChainID: zodBigIntString('Source chain ID'),
    destinationChainID: zodBigIntString('Destination chain ID'),
    sourceToken: zodBlockchainAddress('Source token address'),
    destinationToken: zodBlockchainAddress('Destination token address'),
    sourceAmount: zodBigIntString('Source amount in Wei (as string for BigInt compatibility)'),
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
