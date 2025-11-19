import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { GaslessIntentExecutionResponseEntryDTOSchema } from '@/modules/api/gasless-intents/dtos/gasless-intent-execution-response-entry-dto.schema';

// Main gasless intent response schema
export const GaslessIntentExecutionResponseDTOSchema = extendApi(
  z.object({
    successes: extendApi(z.array(GaslessIntentExecutionResponseEntryDTOSchema), {
      description: 'Array of successful transaction executions',
    }),
    failures: extendApi(z.array(GaslessIntentExecutionResponseEntryDTOSchema), {
      description: 'Array of failed transaction executions',
    }),
  }),
  {
    description: 'Response containing success and failure results for gasless intent execution',
  },
);

export type GaslessIntentExecutionResponseDTO = z.infer<
  typeof GaslessIntentExecutionResponseDTOSchema
>;
