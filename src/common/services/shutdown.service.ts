import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { toError } from '@/common/utils/error-handler';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class ShutdownService implements OnModuleDestroy {
  private shutdownTimeout = 30000; // 30 seconds default

  constructor(private readonly logger: SystemLoggerService) {
    this.logger.setContext(ShutdownService.name);
  }

  async onModuleDestroy() {
    this.logger.log('Starting graceful shutdown...');

    const shutdownPromise = this.performShutdown();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timeout exceeded')), this.shutdownTimeout),
    );

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger.log('Graceful shutdown completed');
    } catch (error) {
      this.logger.error('Shutdown error:', toError(error));
      process.exit(1);
    }
  }

  private async performShutdown() {
    // Shutdown tasks will be handled by individual services implementing OnModuleDestroy
    // This service ensures a timeout for the overall shutdown process
    this.logger.log('Waiting for services to complete shutdown...');
  }
}
