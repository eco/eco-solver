import { Module } from '@nestjs/common'
import { LitActionService } from './lit-action.service'

@Module({
  providers: [LitActionService],
  exports: [LitActionService],
})
export class LitActionsModule {}
