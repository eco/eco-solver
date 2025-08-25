import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class GaslessIntentExecutionResponseEntryDTO {
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  chainID: number

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quoteIDs: string[]

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  transactionHash: Hex

  @ApiPropertyOptional()
  error?: any
}
