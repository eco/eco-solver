import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '@/modules/config/interfaces';

@Injectable()
export class AppConfigService implements AppConfig {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('port');
  }

  get env(): string {
    return this.configService.get<string>('env');
  }
}