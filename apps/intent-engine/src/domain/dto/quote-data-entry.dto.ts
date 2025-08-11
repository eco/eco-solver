import { ApiProperty } from '@nestjs/swagger'
import { Type, Transform } from 'class-transformer'
import { IntentExecutionType } from '../enums/intent-execution-type.enum'
import { QuoteRewardDataDTO } from './quote.reward.data.dto'
import { QuoteRouteDataDTO } from './quote.route.data.dto'
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator'

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
  @Type(() => QuoteRouteDataDTO)
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
