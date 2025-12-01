import { ApiProperty } from '@nestjs/swagger'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator'
import { QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteCallDataDTO, QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
import { Transform, Type } from 'class-transformer'

export class QuoteDataEntryDTO {
  @ApiProperty({
    description: 'Execution method for this quote entry',
    enum: IntentExecutionType.enumKeys,
    example: 'SELF_PUBLISH',
  })
  @IsString()
  @IsIn(IntentExecutionType.enumKeys)
  @IsNotEmpty()
  intentExecutionType: string

  @IsNotEmpty()
  @IsArray()
  @ApiProperty({
    description: 'Tokens required for the route execution',
    type: [QuoteRewardTokensDTO],
  })
  @ValidateNested()
  @Type(() => QuoteRewardTokensDTO)
  routeTokens: QuoteRewardTokensDTO[]

  @IsNotEmpty()
  @ArrayNotEmpty()
  @IsArray()
  @ApiProperty({
    description: 'Contract calls to be executed',
    type: [QuoteCallDataDTO],
  })
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  routeCalls: QuoteCallDataDTO[]

  @IsNotEmpty()
  @IsArray()
  @ApiProperty({
    description: 'Tokens included in the solver reward',
    type: [QuoteRewardTokensDTO],
  })
  @ValidateNested()
  @Type(() => QuoteRewardTokensDTO)
  rewardTokens: QuoteRewardTokensDTO[]

  @IsNotEmpty()
  @ApiProperty({
    description: 'Native token amount (wei) in solver reward',
    example: '0',
  })
  @Transform(({ value }) => BigInt(value))
  rewardNative: bigint

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'ISO 8601 timestamp when this quote expires',
    example: '2024-12-01T12:00:00Z',
  })
  expiryTime: string

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Estimated seconds for solver to fulfill the intent',
    example: 300,
  })
  estimatedFulfillTimeSec: number

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Estimated gas units overhead for execution',
    example: 150000,
  })
  gasOverhead: number
}
