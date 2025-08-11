import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { QuoteRouteDataDTO } from './quote-route-data.dto'
import { QuoteRewardDataDTO } from './quote-reward-data.dto'
import { GaslessIntentDataDTO } from './gasless-intent-data.dto'

// Import from shared constants when available
const IntentExecutionType = {
  enumKeys: ['GASLESS', 'GAS_PAID'] // This should come from shared constants
}

export interface QuoteIntentDataInterface {
  // The dApp ID of the intent, optional so schema can be shared for onchain intents and offchain quotes
  dAppID?: string
  route: any // QuoteRouteDataInterface
  reward: any // QuoteRewardDataType
}

/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export class QuoteIntentDataDTO implements QuoteIntentDataInterface {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  quoteID: string

  @IsNotEmpty()
  @ApiProperty()
  dAppID: string

  @ApiProperty({ isArray: true, enum: IntentExecutionType.enumKeys })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
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