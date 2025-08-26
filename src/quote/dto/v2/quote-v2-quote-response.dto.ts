import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'
import { QuoteV2FeeDTO } from '@/quote/dto/v2/quote-v2-fee.dto'
import { Type } from 'class-transformer'

export class QuoteV2QuoteResponseDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  sourceChainID: number

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  destinationChainID: number

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  sourceToken: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  destinationToken: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  sourceAmount: string

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  destinationAmount: string

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  funder: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refundRecipient: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  recipient: Hex

  @ApiProperty({ type: [QuoteV2FeeDTO] })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuoteV2FeeDTO)
  fees: QuoteV2FeeDTO[]

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  deadline: number

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  estimatedFulfillTimeSec: number
}
