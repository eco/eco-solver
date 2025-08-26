import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator'
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
