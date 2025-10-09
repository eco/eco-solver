import { Hex } from 'viem';
import { z } from 'zod';

import { UniversalAddress } from '@/common/types/universal-address.type';

/**
 * Zod schema for Intent data stored in MongoDB
 * Transforms strings to proper types (bigint, Hex, UniversalAddress)
 */

const CallSchema = z.object({
  data: z.string().transform((val) => val as Hex),
  target: z.string().transform((val) => val as UniversalAddress),
  value: z.string().transform((val) => BigInt(val)),
});

const TokenSchema = z.object({
  amount: z.string().transform((val) => BigInt(val)),
  token: z.string().transform((val) => val as UniversalAddress),
});

const RouteSchema = z.object({
  salt: z.string().transform((val) => val as Hex),
  deadline: z.string().transform((val) => BigInt(val)),
  portal: z.string().transform((val) => val as UniversalAddress),
  nativeAmount: z.string().transform((val) => BigInt(val)),
  tokens: z.array(TokenSchema),
  calls: z.array(CallSchema),
});

const RewardSchema = z.object({
  deadline: z.string().transform((val) => BigInt(val)),
  creator: z.string().transform((val) => val as UniversalAddress),
  prover: z.string().transform((val) => val as UniversalAddress),
  nativeAmount: z.string().transform((val) => BigInt(val)),
  tokens: z.array(TokenSchema),
});

export const IntentDataSchema = z.object({
  destination: z.string().transform((val) => BigInt(val)),
  sourceChainId: z.string().transform((val) => BigInt(val)),
  route: RouteSchema,
  reward: RewardSchema,
});

export type IntentData = z.infer<typeof IntentDataSchema>;
