import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodAddress, zodBigIntString, zodHex } from '@/common/utils/zod-to-swagger.util';

// Token schema with OpenAPI metadata
const TokenSchema = extendApi(
  z.object({
    amount: zodBigIntString('Amount of the token'),
    token: zodAddress('ERC20 token contract address'),
  }),
  {
    description: 'Token transfer details',
  },
);

// Call schema with OpenAPI metadata
const CallSchema = extendApi(
  z.object({
    data: zodHex('Encoded function call data'),
    target: zodAddress('Target contract address for the call'),
    value: zodBigIntString('Native token value to send with the call'),
  }),
  {
    description: 'Function call to execute on destination chain',
  },
);

// Reward schema with OpenAPI metadata
const RewardSchema = extendApi(
  z.object({
    prover: zodAddress('Address of the prover contract'),
    creator: zodAddress('Address of the intent creator'),
    deadline: zodBigIntString('Deadline timestamp for the intent'),
    nativeAmount: zodBigIntString('Native amount reward value'),
    tokens: extendApi(z.array(TokenSchema), {
      description: 'Array of ERC20 token rewards',
    }),
  }),
  {
    description: 'Reward configuration for the intent',
  },
);

// Route schema with OpenAPI metadata
const RouteSchema = extendApi(
  z.object({
    source: zodBigIntString('Source chain ID'),
    destination: zodBigIntString('Destination chain ID'),
    salt: zodHex('Salt value for intent uniqueness'),
    portal: zodAddress('Portal contract address on destination chain'),
    nativeAmount: zodBigIntString('Native amount route value'),
    calls: extendApi(z.array(CallSchema), {
      description: 'Array of calls to execute on destination chain',
    }),
    tokens: extendApi(z.array(TokenSchema), {
      description: 'Array of tokens to transfer on the route',
    }),
  }),
  {
    description: 'Route configuration for cross-chain execution',
  },
);

// Intent schema with OpenAPI metadata
export const IntentSchema = extendApi(
  z.object({
    reward: RewardSchema,
    route: RouteSchema,
  }),
  {
    description: 'Intent object containing reward and route information',
  },
);

// Quote request schema with OpenAPI metadata
export const QuoteRequestSchema = extendApi(
  z.object({
    intent: IntentSchema,
    strategy: extendApi(
      z
        .enum(['standard', 'crowd-liquidity', 'native-intents', 'negative-intents', 'rhinestone'])
        .optional(),
      {
        description:
          'Strategy to use for fulfillment. If not specified, the default strategy is used.',
        example: 'standard',
      },
    ),
  }),
  {
    description: 'Request body for getting a quote for an intent',
  },
);

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
