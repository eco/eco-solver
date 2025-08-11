import { Module } from "@nestjs/common"
import { BullModule } from '@nestjs/bull'
import { IntentFundedEventsModule } from "./intent/intent-funded-events/intent-funded-events.module"
import { WatchCreateIntentService } from "./intent/watch-create-intent.service"
import { WatchFulfillmentService } from "./intent/watch-fulfillment.service"
import { MultichainPublicClientService, EcoConfigService, EcoAnalyticsService } from "@libs/integrations"
import { IntentEventQueueManager } from "@libs/messaging"

@Module({
  imports: [
    BullModule.registerQueue({ name: 'source-intent' }),
    BullModule.registerQueue({ name: 'intent-fulfillment' }),
    IntentFundedEventsModule,
  ],
  providers: [
    MultichainPublicClientService,
    EcoConfigService,
    EcoAnalyticsService,
    IntentEventQueueManager,
    WatchCreateIntentService,
    WatchFulfillmentService
  ],
  exports: [WatchCreateIntentService, WatchFulfillmentService, IntentFundedEventsModule],
})
export class WatchModule {}
