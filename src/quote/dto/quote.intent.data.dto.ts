import { RewardDataDTO } from '@/quote/dto/reward.data.dto'
import { RouteDataDTO } from '@/quote/dto/route.data.dto'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'

/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export class QuoteIntentDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  route: RouteDataDTO

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  reward: RewardDataDTO
}
