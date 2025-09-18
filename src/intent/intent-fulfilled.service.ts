import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FulfillmentLog } from '@/contracts/inbox'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { IntentInitiationV2Service } from '@/intent-initiation/services/intent-initiation-v2.service'
import { ModuleRef } from '@nestjs/core'
import { UtilsIntentService } from '@/intent/utils-intent.service'

@Injectable()
export class IntentFulfilledService implements OnModuleInit {
  private logger = new EcoLogger(IntentFulfilledService.name)
  private intentInitiationService: IntentInitiationV2Service

  constructor(
    private readonly utilsIntentService: UtilsIntentService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    this.intentInitiationService = this.moduleRef.get(IntentInitiationV2Service, { strict: false })

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `IntentFulfilledService.onModuleInit`,
      }),
    )
  }

  async processFulfilled(fulfillmentLog: FulfillmentLog) {
    await this.utilsIntentService.updateOnFulfillment(fulfillmentLog)
    await this.intentInitiationService.processFulfilled(fulfillmentLog)
    return {}
  }
}
