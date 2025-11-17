import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodBlockchainAddress, zodHex } from '@/common/utils/zod-to-swagger.util';
import { AllowanceOrTransferDTOSchema } from '@/modules/api/gasless-intents/dtos/permit3/allowance-or-transfer-dto.schema';

// Permit3 schema
export const Permit3DTOSchema = extendApi(
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
    allowanceOrTransfers: extendApi(z.array(AllowanceOrTransferDTOSchema).nonempty(), {
      description:
        'Flattened list of all permits across chains used to construct ChainPermits and Merkle tree leaves',
    }),
  }),
  {
    description: 'Permit3 signature data for multi-chain token approvals',
  },
);

export type Permit3DTO = z.infer<typeof Permit3DTOSchema>;
