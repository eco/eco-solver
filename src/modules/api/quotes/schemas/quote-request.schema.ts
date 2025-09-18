import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodBigIntString, zodBlockchainAddress } from '@/common/utils/zod-to-swagger.util';

// Contracts schema for optional validation
const ContractsSchema = extendApi(
  z.object({
    sourcePortal: zodBlockchainAddress('Portal contract address on source chain').optional(),
    destinationPortal: zodBlockchainAddress(
      'Portal contract address on destination chain',
    ).optional(),
    prover: zodBlockchainAddress('Prover contract address on source chain').optional(),
  }),
  {
    description: 'Optional contract addresses to validate against solver configuration',
  },
);

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
    contracts: ContractsSchema.optional(),
  }),
  {
    description: 'Request body for getting a quote for a cross-chain token swap',
  },
);

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
