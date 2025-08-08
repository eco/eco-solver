import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class ShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(ShutdownService.name);
  private shutdownTimeout = 30000; // 30 seconds default

  constructor(private moduleRef: ModuleRef) {}

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
      this.logger.error('Shutdown error:', error);
      process.exit(1);
    }
  }

  private async performShutdown() {
    // Shutdown tasks will be handled by individual services implementing OnModuleDestroy
    // This service ensures a timeout for the overall shutdown process
    this.logger.log('Waiting for services to complete shutdown...');
  }
}
