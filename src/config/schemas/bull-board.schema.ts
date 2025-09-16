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
