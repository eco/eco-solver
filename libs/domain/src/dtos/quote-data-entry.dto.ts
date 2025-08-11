import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator'
import { QuoteRewardTokensDTO } from './quote-reward-tokens.dto'
import { QuoteCallDataDTO } from './quote-call-data.dto'

// Import from shared constants when available
const IntentExecutionType = {
  enumKeys: ['GASLESS', 'GAS_PAID'] // This should come from shared constants
}

export class QuoteDataEntryDTO {
  @ApiProperty({ enum: IntentExecutionType.enumKeys })
  @IsString()
  @IsIn(IntentExecutionType.enumKeys)
  @IsNotEmpty()
  intentExecutionType: string

  @IsNotEmpty()
  @IsArray()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRewardTokensDTO)
  routeTokens: QuoteRewardTokensDTO[]

  @IsNotEmpty()
  @ArrayNotEmpty()
  @IsArray()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteCallDataDTO)
  routeCalls: QuoteCallDataDTO[]

  @IsNotEmpty()
  @IsArray()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRewardTokensDTO)
  rewardTokens: QuoteRewardTokensDTO[]

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  rewardNative: bigint

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  expiryTime: string

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  estimatedFulfillTimeSec: number

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  gasOverhead: number
}