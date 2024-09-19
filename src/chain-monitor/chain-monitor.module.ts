import { Module } from '@nestjs/common'
import { EcoConfigModule } from '../eco-configs/eco-config.module'
import { SourceIntentModel, SourceIntentSchema } from '../intent/schemas/source-intent.schema'
import { MongooseModule } from '@nestjs/mongoose'
import { AlchemyModule } from '../alchemy/alchemy.module'
import { IntentModule } from '../intent/intent.module'
import { ChainSyncService } from './chain-sync.service'

@Module({
  imports: [
    AlchemyModule,
    EcoConfigModule,
    IntentModule,
    MongooseModule.forFeature([{ name: SourceIntentModel.name, schema: SourceIntentSchema }]),
  ],
  providers: [ChainSyncService],
  exports: [ChainSyncService],
})
export class ChainMonitorModule {}
