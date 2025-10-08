import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodBlockchainAddress, zodHex } from '@/common/utils/zod-to-swagger.util';

// AllowanceOrTransfer schema
const AllowanceOrTransferSchema = extendApi(
  z.object({
    chainID: extendApi(z.number().int(), {
      description: 'The chain ID where the allowance or transfer occurs',
      example: 1,
    }),
    modeOrExpiration: extendApi(z.number().int(), {
      description: 'Mode for transfer (0) or expiration timestamp for allowance update',
      example: 0,
    }),
    tokenKey: extendApi(zodHex('Encoded tokenKey'), {
      description: 'Token key',
    }),
    account: extendApi(zodBlockchainAddress('Account address'), {
      description: 'Account address',
    }),
    amountDelta: extendApi(
      z
        .string()
        .or(z.bigint())
        .transform((val) => (typeof val === 'string' ? BigInt(val) : val)),
      {
        description: 'Amount delta for the allowance or transfer (in wei)',
        example: '1000000000000000000',
      },
    ),
  }),
  {
    description: 'Allowance or transfer permit entry',
  },
);

// Permit3 schema
const Permit3Schema = extendApi(
  z.object({
    chainId: extendApi(z.number().int(), {
      description: 'The original chain ID where the request is being signed or executed',
      example: 1,
    }),
    permitContract: zodBlockchainAddress('Address of the Permit3 contract'),
    owner: extendApi(zodBlockchainAddress('Owner address of the tokens being permitted'), {
      description: 'Owner address',
    }),
    salt: extendApi(zodHex('Unique salt value'), {
      description: 'Unique salt',
    }),
    signature: extendApi(zodHex('EIP-712 cryptographic signature'), {
      description: 'Signature',
    }),
    deadline: extendApi(
      z
        .string()
        .or(z.number())
        .or(z.bigint())
        .transform((val) => {
          if (typeof val === 'bigint') return val;
          if (typeof val === 'string') return BigInt(val);
          return BigInt(val);
        }),
      {
        description: 'Expiration timestamp for the permit signature (uint48)',
        example: '1699999999',
      },
    ),
    timestamp: extendApi(z.number().int(), {
      description: 'Unix timestamp when the permit was created (uint48)',
      example: 1699988888,
    }),
    merkleRoot: extendApi(zodHex('Merkle root hash'), {
      description: 'Merkle root',
    }),
    leaves: extendApi(z.array(zodHex('Merkle tree leaf hash')).optional(), {
      description:
        'Optional array of Merkle tree leaves (hashed ChainPermits), useful for client-side debugging or proof regeneration',
    }),
    allowanceOrTransfers: extendApi(z.array(AllowanceOrTransferSchema).nonempty(), {
      description:
        'Flattened list of all permits across chains used to construct ChainPermits and Merkle tree leaves',
    }),
  }),
  {
    description: 'Permit3 signature data for multi-chain token approvals',
  },
);

// GaslessIntentData schema
const GaslessIntentDataSchema = extendApi(
  z.object({
    permit3: Permit3Schema,
    allowPartial: extendApi(z.boolean().optional().default(false), {
      description: 'Whether to allow partial funding of the intent',
      example: false,
    }),
  }),
  {
    description: 'Gasless intent data containing permit information',
  },
);

// Intent schema (nested in request)
const IntentSchema = extendApi(
  z.object({
    quoteID: extendApi(z.string(), {
      description: 'Unique identifier for the quote',
      example: 'quote_12345',
    }),
    salt: extendApi(zodHex('Unique salt'), {
      description: 'Salt',
    }),
  }),
  {
    description: 'Intent information',
  },
);

// Main gasless intent request schema
export const GaslessIntentRequestSchema = extendApi(
  z.object({
    gaslessInitiationId: extendApi(z.string(), {
      description: 'Unique identifier for this gasless initiation request',
      example: 'gasless_init_12345',
    }),
    dAppID: extendApi(z.string(), {
      description: 'Identifier of the requesting dApp',
      example: 'my-dapp-v1',
    }),
    intents: extendApi(z.array(IntentSchema).nonempty(), {
      description: 'Array of intents to be initiated',
    }),
    gaslessIntentData: GaslessIntentDataSchema,
  }),
  {
    description: 'Request body for initiating a gasless intent',
  },
);

export type GaslessIntentRequest = z.infer<typeof GaslessIntentRequestSchema>;
export type Permit3 = z.infer<typeof Permit3Schema>;
export type AllowanceOrTransfer = z.infer<typeof AllowanceOrTransferSchema>;
export type GaslessIntentData = z.infer<typeof GaslessIntentDataSchema>;
export type Intent = z.infer<typeof IntentSchema>;
