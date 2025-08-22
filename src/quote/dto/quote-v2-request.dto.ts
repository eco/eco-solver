import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Hex } from 'viem'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'

export class QuoteV2QuoteRequestDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  sourceChainID: number

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  destinationChainID: number

  @ApiProperty()
  @ViemAddressTransform()
  @IsNotEmpty()
  sourceToken: Hex

  @ApiProperty()
  @ViemAddressTransform()
  @IsNotEmpty()
  destinationToken: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  sourceAmount: string

  @ApiProperty()
  @ViemAddressTransform()
  @IsNotEmpty()
  funder: Hex

  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  refundRecipient?: Hex

  @ApiProperty()
  @ViemAddressTransform()
  @IsNotEmpty()
  recipient: Hex
}

export class QuoteV2ContractsRequestDTO {
  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  intentSource?: Hex

  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  prover?: Hex

  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  inbox?: Hex
}

export class QuoteV2RequestDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  dAppID: string

  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2QuoteRequestDTO)
  quoteRequest: QuoteV2QuoteRequestDTO

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteV2ContractsRequestDTO)
  contracts?: QuoteV2ContractsRequestDTO
}
