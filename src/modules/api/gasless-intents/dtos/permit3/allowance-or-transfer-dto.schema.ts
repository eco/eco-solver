import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodBlockchainAddress, zodHex } from '@/common/utils/zod-to-swagger.util';

// AllowanceOrTransfer schema
export const AllowanceOrTransferDTOSchema = extendApi(
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

export type AllowanceOrTransferDTO = z.infer<typeof AllowanceOrTransferDTOSchema>;
