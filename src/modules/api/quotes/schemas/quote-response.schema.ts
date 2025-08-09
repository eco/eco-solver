import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodAddress, zodHex } from '@/common/utils/zod-to-swagger.util';

// Token info schema
const TokenInfoSchema = extendApi(
  z.object({
    address: zodAddress('Token contract address'),
    decimals: extendApi(z.number(), {
      description: 'Token decimals',
      example: 18,
    }),
    symbol: extendApi(z.string(), {
      description: 'Token symbol',
      example: 'WETH',
    }),
  }),
  {
    description: 'Token information',
  },
);

// Fee schema with OpenAPI metadata
const FeeSchema = extendApi(
  z.object({
    name: extendApi(z.literal('Eco Protocol Fee'), {
      description: 'Fee name',
      example: 'Eco Protocol Fee',
    }),
    description: extendApi(z.string(), {
      description: 'Fee description',
      example: 'Fee charged by Eco Protocol for intent fulfillment',
    }),
    token: TokenInfoSchema,
    amount: extendApi(z.string(), {
      description: 'Fee amount (as string for BigInt compatibility)',
      example: '1000000000000000',
    }),
  }),
  {
    description: 'Fee details',
  },
);

// Quote data schema with OpenAPI metadata
const QuoteDataSchema = extendApi(
  z.object({
    sourceChainID: extendApi(z.number(), {
      description: 'Source chain ID',
      example: 1,
    }),
    destinationChainID: extendApi(z.number(), {
      description: 'Destination chain ID',
      example: 137,
    }),
    sourceToken: zodHex('Source token address'),
    destinationToken: zodHex('Destination token address'),
    sourceAmount: extendApi(z.string(), {
      description: 'Source amount (as string for BigInt compatibility)',
      example: '1000000000000000000',
    }),
    destinationAmount: extendApi(z.string(), {
      description: 'Destination amount (as string for BigInt compatibility)',
      example: '990000000000000000',
    }),
    funder: zodHex('Address funding the intent'),
    refundRecipient: zodHex('Address to receive refunds'),
    recipient: zodHex('Address to receive tokens on destination'),
    fees: extendApi(z.array(FeeSchema), {
      description: 'Array of fees required for fulfillment',
    }),
    deadline: extendApi(z.number(), {
      description: 'Deadline timestamp (UNIX seconds)',
      example: 1735689600,
    }),
    estimatedFulfillTimeSec: extendApi(z.number(), {
      description: 'Estimated fulfillment time in seconds',
      example: 300,
    }),
  }),
  {
    description: 'Quote data with fees and details',
  },
);

// Contracts schema with OpenAPI metadata
const ContractsSchema = extendApi(
  z.object({
    intentSource: zodHex('IntentSource contract address on source chain'),
    prover: zodHex('Prover contract address'),
    inbox: zodHex('Inbox contract address on destination chain'),
  }),
  {
    description: 'Contract addresses involved in the intent',
  },
);

// Validation error schema
const ValidationErrorSchema = extendApi(
  z.object({
    validation: extendApi(z.string(), {
      description: 'Name of the validation that failed',
      example: 'funding',
    }),
    reason: extendApi(z.string(), {
      description: 'Reason for validation failure',
      example: 'Insufficient token balance',
    }),
  }),
  {
    description: 'Validation error details',
  },
);

// Schema for successful quote response
export const SuccessfulQuoteResponseSchema = extendApi(
  z.object({
    quoteResponse: QuoteDataSchema,
    contracts: ContractsSchema,
  }),
  {
    description: 'Successful quote response with fees and contract addresses',
  },
);

// Schema for failed quote response (validation errors)
export const FailedQuoteResponseSchema = extendApi(
  z.object({
    validations: extendApi(
      z.object({
        passed: extendApi(z.array(z.string()), {
          description: 'List of validations that passed',
          example: ['chain-support', 'expiration'],
        }),
        failed: extendApi(z.array(ValidationErrorSchema), {
          description: 'List of validations that failed with reasons',
        }),
      }),
      {
        description: 'Validation results showing which checks passed and failed',
      },
    ),
  }),
  {
    description: 'Failed quote response with validation errors',
  },
);

export const QuoteResponseSchema = z.union([
  SuccessfulQuoteResponseSchema,
  FailedQuoteResponseSchema,
]);

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
export type SuccessfulQuoteResponse = z.infer<typeof SuccessfulQuoteResponseSchema>;
export type FailedQuoteResponse = z.infer<typeof FailedQuoteResponseSchema>;
