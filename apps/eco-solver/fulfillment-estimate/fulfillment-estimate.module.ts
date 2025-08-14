import { Module } from '@nestjs/common'
import { FulfillmentEstimateService } from './fulfillment-estimate.service'

@Module({
  providers: [FulfillmentEstimateService],
  exports: [FulfillmentEstimateService],
})
export class FulfillmentEstimateModule {}
