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
}
