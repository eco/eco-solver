import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WithdrawalConfig } from '@/config/schemas';

@Injectable()
export class WithdrawalConfigService {
  constructor(private configService: ConfigService) {}

  get checkIntervalMinutes(): WithdrawalConfig['checkIntervalMinutes'] {
    return this.configService.get<number>('withdrawal.checkIntervalMinutes')!;
  }
}
