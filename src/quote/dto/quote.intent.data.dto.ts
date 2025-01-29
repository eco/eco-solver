import { QuoteRewardDataInterface } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'

/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export class QuoteIntentDataDTO implements QuoteIntentDataInterface {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  route: QuoteRouteDataInterface

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  reward: QuoteRewardDataInterface
}

export interface QuoteIntentDataInterface {
  route: QuoteRouteDataInterface
  reward: QuoteRewardDataInterface
}
