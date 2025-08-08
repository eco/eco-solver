import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'
import { Hex } from 'viem'

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

export class QuoteV2FeeDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string

  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2TokenDTO)
  token: QuoteV2TokenDTO

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  amount: string
}

export class QuoteV2ContractsDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  intentSource: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  prover: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  inbox: Hex
}

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

export class QuoteV2ResponseDTO {
  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2QuoteResponseDTO)
  quoteResponse: QuoteV2QuoteResponseDTO

  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2ContractsDTO)
  contracts: QuoteV2ContractsDTO
}
