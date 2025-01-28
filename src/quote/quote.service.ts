import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor() {} // private readonly kernelAccountClientService: KernelAccountClientService, // private readonly ecoConfig: EcoConfigService,

  async onApplicationBootstrap() {}

  async getQuote() {
    return
  }
}
