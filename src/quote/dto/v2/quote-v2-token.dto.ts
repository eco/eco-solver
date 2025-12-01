import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsString, IsNumber } from 'class-validator'

export class QuoteV2TokenDTO {
  @ApiProperty({
    description: 'Token contract address',
    example: '0xA0b86a33E6441e45C3b9d1C3D6a0b5be4b7b5b5a',
  })
  @IsNotEmpty()
  @IsString()
  address: Hex

  @ApiProperty({
    description: 'Number of decimal places for token amounts',
    example: 6,
  })
  @IsNotEmpty()
  @IsNumber()
  decimals: number

  @ApiProperty({
    description: 'Token symbol (e.g., USDC, WETH)',
    example: 'USDC',
  })
  @IsNotEmpty()
  @IsString()
  symbol: string
}
