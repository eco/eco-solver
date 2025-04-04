import { ApiProperty } from '@nestjs/swagger'
import { IntentExecutionType } from '../enums/intent-execution-type.enum'
import { IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator'
import { RewardTokensInterface } from '@/contracts'

export class QuoteDataEntryDTO {
  @ApiProperty({ enum: IntentExecutionType.enumKeys })
  @IsString()
  @IsIn(IntentExecutionType.enumKeys)
  @IsNotEmpty()
  intentExecutionType: string

  @IsNotEmpty()
  @IsArray()
  @ApiProperty()
  tokens: RewardTokensInterface[]

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  expiryTime: string
}
