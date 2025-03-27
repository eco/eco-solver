import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, IsString } from 'class-validator'
// import { TokenAmountDataDTO } from '../../intents/dtos/token-amount-data.dto'
import { RewardTokensInterface } from '@/contracts'

export class QuoteDataEntryDTO {
  @ApiProperty()
  @IsString()
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
