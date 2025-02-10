import { QuoteRewardDataDTO, QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
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
  @Type(() => QuoteRouteDataDTO)
  route: QuoteRouteDataDTO

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRewardDataDTO)
  reward: QuoteRewardDataDTO
}

export interface QuoteIntentDataInterface {
  route: QuoteRouteDataInterface
  reward: QuoteRewardDataType
}
