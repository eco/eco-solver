import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodHex } from '@/common/utils/zod-to-swagger.util';

// Response entry schema (for both successes and failures)
export const GaslessIntentExecutionResponseEntryDTOSchema = extendApi(
  z.object({
    chainID: extendApi(z.number().int(), {
      description: 'Chain ID where the transaction was executed',
      example: 1,
    }),
    quoteIDs: extendApi(z.array(z.string()), {
      description: 'Array of quote IDs included in this transaction',
      example: ['quote_12345', 'quote_67890'],
    }),
    transactionHash: zodHex('Transaction hash of the executed transaction').optional(),
    error: extendApi(z.string().optional(), {
      description: 'Error message if the transaction failed',
      example: 'Insufficient gas',
    }),
  }),
  {
    description: 'Execution result for a single chain',
  },
);

export type GaslessIntentExecutionResponseEntryDTO = z.infer<
  typeof GaslessIntentExecutionResponseEntryDTOSchema
>;
