import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsString, IsNumber } from 'class-validator'

export class QuoteV2TokenDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  address: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  decimals: number

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  symbol: string
}
