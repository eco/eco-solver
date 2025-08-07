import { z } from 'zod';

// Address validation regex
const AddressRegex = /^0x[a-fA-F0-9]{40}$/;
const HexRegex = /^0x[a-fA-F0-9]*$/;

// Intent schema based on the Intent interface
export const IntentSchema = z.object({
  reward: z.object({
    prover: z.string().regex(AddressRegex, 'Invalid prover address'),
    creator: z.string().regex(AddressRegex, 'Invalid creator address'),
    deadline: z.string().transform((val) => BigInt(val)),
    nativeValue: z.string().transform((val) => BigInt(val)),
    tokens: z.array(
      z.object({
        amount: z.string().transform((val) => BigInt(val)),
        token: z.string().regex(AddressRegex, 'Invalid token address'),
      }),
    ),
  }),
  route: z.object({
    source: z.string().transform((val) => BigInt(val)),
    destination: z.string().transform((val) => BigInt(val)),
    salt: z.string().regex(HexRegex, 'Invalid salt hex'),
    inbox: z.string().regex(AddressRegex, 'Invalid inbox address'),
    calls: z.array(
      z.object({
        data: z.string().regex(HexRegex, 'Invalid call data hex'),
        target: z.string().regex(AddressRegex, 'Invalid target address'),
        value: z.string().transform((val) => BigInt(val)),
      }),
    ),
    tokens: z.array(
      z.object({
        amount: z.string().transform((val) => BigInt(val)),
        token: z.string().regex(AddressRegex, 'Invalid token address'),
      }),
    ),
  }),
});

export const QuoteRequestSchema = z.object({
  intent: IntentSchema,
  strategy: z
    .enum(['standard', 'crowd-liquidity', 'native-intents', 'negative-intents', 'rhinestone'])
    .optional(),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
