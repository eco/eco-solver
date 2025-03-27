import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { GaslessIntentDataDTO } from './gasless-intent-data.dto'
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { QuoteRewardDataDTO, QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { Type } from 'class-transformer'

/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export class QuoteIntentDataDTO implements QuoteIntentDataInterface {
  @IsNotEmpty()
  @ApiProperty()
  dAppID: string

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  intentExecutionTypes: string[]

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

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData?: GaslessIntentDataDTO
}

export interface QuoteIntentDataInterface {
  // The dApp ID of the intent, optional so schema can be shared for onchain intents and offchain quotes
  dAppID?: string
  route: QuoteRouteDataInterface
  reward: QuoteRewardDataType
}
