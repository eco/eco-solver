import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { HatsService } from '@/hats/hats.service';

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly hatsService: HatsService,
  ) {
  }

  async onModuleInit() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${TasksService.name}.onModuleInit()`,
      }),
    );
  }

  @Cron('*/30 * * * *', { timeZone: 'America/Los_Angeles' }) // every 30 minutes
  async hatsWeeklyTurnover() {
    this.logger.debug(EcoLogMessage.fromDefault({
      message: `${TasksService.name}.hatsWeeklyTurnover`,
    }));

    await this.hatsService.weeklyUpdate();

    this.logger.debug(EcoLogMessage.fromDefault({
      message: `${TasksService.name}.hatsWeeklyTurnover complete`,
    }));
  }
}