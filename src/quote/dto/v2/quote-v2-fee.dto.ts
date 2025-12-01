import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { QuoteV2TokenDTO } from '@/quote/dto/v2/quote-v2-token.dto'
import { Type } from 'class-transformer'

export class QuoteV2FeeDTO {
  @ApiProperty({
    description: 'Name of the fee component',
    example: 'Protocol Fee',
  })
  @IsNotEmpty()
  @IsString()
  name: string

  @ApiProperty({
    description: 'Detailed explanation of this fee',
    example: 'Fee charged by the protocol for cross-chain message relay',
  })
  @IsNotEmpty()
  @IsString()
  description: string

  @ApiProperty({
    description: 'Token in which the fee is denominated',
    type: () => QuoteV2TokenDTO,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2TokenDTO)
  token: QuoteV2TokenDTO

  @ApiProperty({
    description: 'Fee amount in smallest token unit (as string)',
    example: '1000',
  })
  @IsNotEmpty()
  @IsString()
  amount: string
}
