import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { WithdrawalSchema } from '@/config/config.schema';

type WithdrawalConfig = z.infer<typeof WithdrawalSchema>;

@Injectable()
export class WithdrawalConfigService {
  constructor(private configService: ConfigService) {}

  get checkIntervalMinutes(): WithdrawalConfig['checkIntervalMinutes'] {
    return this.configService.get<number>('withdrawal.checkIntervalMinutes')!;
  }
}
