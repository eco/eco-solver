import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { GaslessIntentDataDTO } from '@/quote/dto/gasless-intent-data.dto'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { QuoteRewardDataDTO, QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { Type } from 'class-transformer'

/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export class QuoteIntentDataDTO implements QuoteIntentDataInterface {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Unique identifier for this quote request',
    example: 'quote:966ee977-586b-4bca-abf1-e7def508a19c',
  })
  quoteID: string

  @IsNotEmpty()
  @ApiProperty({
    description: 'Identifier of the dApp requesting the quote',
    example: 'my-dapp-id',
  })
  dAppID: string

  @ApiProperty({
    description: 'Array of supported execution methods for the intent',
    isArray: true,
    enum: IntentExecutionType.enumKeys,
    example: ['SELF_PUBLISH', 'GASLESS'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
  @IsNotEmpty()
  intentExecutionTypes: string[]

  @IsNotEmpty()
  @ApiProperty({
    description: 'Route configuration specifying source, destination, and calls',
    type: () => QuoteRouteDataDTO,
  })
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  route: QuoteRouteDataDTO

  @IsNotEmpty()
  @ApiProperty({
    description: 'Reward configuration for solvers fulfilling the intent',
    type: () => QuoteRewardDataDTO,
  })
  @ValidateNested()
  @Type(() => QuoteRewardDataDTO)
  reward: QuoteRewardDataDTO

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional({
    description: 'Optional permit signatures for gasless execution',
    type: () => GaslessIntentDataDTO,
  })
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData?: GaslessIntentDataDTO
}

export interface QuoteIntentDataInterface {
  // The dApp ID of the intent, optional so schema can be shared for onchain intents and offchain quotes
  dAppID?: string
  route: QuoteRouteDataInterface
  reward: QuoteRewardDataType
}
