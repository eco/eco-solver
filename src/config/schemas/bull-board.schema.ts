import { registerAs } from '@nestjs/config';

import { z } from 'zod';

/**
 * Bull Board configuration schema
 */
export const BullBoardSchema = z.object({
  enabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export type BullBoardConfig = z.infer<typeof BullBoardSchema>;

/**
 * Bull Board configuration factory
 */
export const bullBoardConfig = registerAs('bullBoard', () => {
  const config = BullBoardSchema.parse({
    enabled: process.env.BULL_BOARD_ENABLED ? process.env.BULL_BOARD_ENABLED === 'true' : undefined,
    username: process.env.BULL_BOARD_USERNAME,
    password: process.env.BULL_BOARD_PASSWORD,
  });

  return config;
});
