import { z } from 'zod';

const HexRegex = /^0x[a-fA-F0-9]*$/;
const AddressRegex = /^0x[a-fA-F0-9]{40}$/;

const FeeSchema = z.object({
  name: z.literal('Eco Protocol Fee'),
  description: z.string(),
  token: z.object({
    address: z.string().regex(AddressRegex),
    decimals: z.number(),
    symbol: z.string(),
  }),
  amount: z.string(), // Serialized bigint
});

const QuoteDataSchema = z.object({
  sourceChainID: z.number(),
  destinationChainID: z.number(),
  sourceToken: z.string().regex(HexRegex),
  destinationToken: z.string().regex(HexRegex),
  sourceAmount: z.string(), // Serialized bigint
  destinationAmount: z.string(), // Serialized bigint
  funder: z.string().regex(HexRegex),
  refundRecipient: z.string().regex(HexRegex),
  recipient: z.string().regex(HexRegex),
  fees: z.array(FeeSchema),
  deadline: z.number(), // UNIX seconds since epoch
  estimatedFulfillTimeSec: z.number(),
});

const ContractsSchema = z.object({
  intentSource: z.string().regex(HexRegex),
  prover: z.string().regex(HexRegex),
  inbox: z.string().regex(HexRegex),
});

// Schema for successful quote response
export const SuccessfulQuoteResponseSchema = z.object({
  quoteResponse: QuoteDataSchema,
  contracts: ContractsSchema,
});

// Schema for failed quote response (validation errors)
export const FailedQuoteResponseSchema = z.object({
  validations: z.object({
    passed: z.array(z.string()),
    failed: z.array(
      z.object({
        validation: z.string(),
        reason: z.string(),
      }),
    ),
  }),
});

export const QuoteResponseSchema = z.union([
  SuccessfulQuoteResponseSchema,
  FailedQuoteResponseSchema,
]);

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
export type SuccessfulQuoteResponse = z.infer<typeof SuccessfulQuoteResponseSchema>;
export type FailedQuoteResponse = z.infer<typeof FailedQuoteResponseSchema>;
