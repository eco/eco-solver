import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

import { zodHex } from '@/common/utils/zod-to-swagger.util';
import { Permit3DTOSchema } from '@/modules/api/gasless-intents/dtos/permit3/permit3-dto.schema';

// GaslessIntentData schema
export const GaslessIntentDataDTOSchema = extendApi(
  z.object({
    permit3: Permit3DTOSchema,
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
const IntentDTOSchema = extendApi(
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
export const GaslessIntentRequestDTOSchema = extendApi(
  z.object({
    intentGroupID: extendApi(z.string(), {
      description: 'Unique identifier for this gasless initiation request',
      example: 'gasless_init_12345',
    }),
    dAppID: extendApi(z.string(), {
      description: 'Identifier of the requesting dApp',
      example: 'my-dapp-v1',
    }),
    intents: extendApi(z.array(IntentDTOSchema).nonempty(), {
      description: 'Array of intents to be initiated',
    }),
    gaslessIntentData: GaslessIntentDataDTOSchema,
  }),
  {
    description: 'Request body for initiating a gasless intent',
  },
);

export type GaslessIntentRequestDTO = z.infer<typeof GaslessIntentRequestDTOSchema>;
export type GaslessIntentDataDTO = z.infer<typeof GaslessIntentDataDTOSchema>;
export type IntentDTO = z.infer<typeof IntentDTOSchema>;
