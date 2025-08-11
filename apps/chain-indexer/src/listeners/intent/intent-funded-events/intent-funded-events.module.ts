import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BullModule } from '@nestjs/bull'
import { MultichainPublicClientService, EcoConfigService, EcoAnalyticsService } from '@libs/integrations'
import { IntentValidationService } from '@libs/domain'
import { IntentEventQueueManager } from '@libs/messaging'
import { WatchIntentFundedService } from './services/watch-intent-funded.service'
import { IntentFundedEventRepository } from './repositories/intent-funded-event.repository'
import {
  IntentFundedEventModel,
  IntentFundedEventSchema,
} from './schemas/intent-funded-events.schema'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'source-intent' }),
    MongooseModule.forFeature([
      { name: IntentFundedEventModel.name, schema: IntentFundedEventSchema },
    ]),
  ],
  providers: [
    MultichainPublicClientService,
    EcoConfigService,
    EcoAnalyticsService,
    IntentValidationService,
    IntentEventQueueManager,
    WatchIntentFundedService,
    IntentFundedEventRepository
  ],
  exports: [WatchIntentFundedService, IntentFundedEventRepository, MongooseModule],
})
export class IntentFundedEventsModule {}
