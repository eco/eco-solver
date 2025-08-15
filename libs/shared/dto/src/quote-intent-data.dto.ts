import { ApiProperty } from '@nestjs/swagger'
import { IntentExecutionType } from './intent-execution-type.enum'
import { IsArray, IsIn, IsNotEmpty,  IsString } from 'class-validator'
import { RewardType, RouteType } from '@eco-foundation/routes-ts'
/**
 * Basic interface types for the quote intent data
 */
export interface QuoteRouteDataInterface extends Omit<RouteType, 'salt'> {}

export type QuoteRewardDataType = RewardType

export interface QuoteIntentDataInterface {
  // The dApp ID of the intent, optional so schema can be shared for onchain intents and offchain quotes
  dAppID?: string
  route: QuoteRouteDataInterface
  reward: QuoteRewardDataType
}

/**
 * Simplified QuoteIntentDataDTO to break circular dependencies
 * Contains only the essential fields needed by external libraries
 */
export class QuoteIntentDataDTO implements QuoteIntentDataInterface {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  quoteID!: string

  @IsNotEmpty()
  @ApiProperty()
  dAppID!: string

  @ApiProperty({ isArray: true, enum: IntentExecutionType.enumKeys })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
  @IsNotEmpty()
  intentExecutionTypes!: string[]

  @IsNotEmpty()
  @ApiProperty()
  route!: QuoteRouteDataInterface

  @IsNotEmpty()
  @ApiProperty()
  reward!: QuoteRewardDataType
}