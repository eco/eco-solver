import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'

export class QuoteV2QuoteRequestDTO {
  @ApiProperty({
    description: 'Chain ID of the source network where tokens will be sent from',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  sourceChainID: number

  @ApiProperty({
    description: 'Chain ID of the destination network where tokens will be received',
    example: 42161,
  })
  @IsNotEmpty()
  @IsNumber()
  destinationChainID: number

  @ApiProperty({
    description: 'Contract address of the token being sent on the source chain',
    example: '0xA0b86a33E6441e45C3b9d1C3D6a0b5be4b7b5b5a',
  })
  @ViemAddressTransform()
  @IsNotEmpty()
  sourceToken: Hex

  @ApiProperty({
    description: 'Contract address of the token to receive on the destination chain',
    example: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  })
  @ViemAddressTransform()
  @IsNotEmpty()
  destinationToken: Hex

  @ApiProperty({
    description: 'Amount of source tokens to send (as string representation of bigint)',
    example: '1000000',
  })
  @IsNotEmpty()
  @IsString()
  sourceAmount: string

  @ApiProperty({
    description: 'Address that will provide the tokens',
    example: '0x742d35Cc6527C92b4A1F3a2a8b1c9b3e8c4c5b2a',
  })
  @ViemAddressTransform()
  @IsNotEmpty()
  funder: Hex

  @ApiPropertyOptional({
    description: 'Address to receive refunds if the intent fails (optional, defaults to funder)',
    example: '0x742d35Cc6527C92b4A1F3a2a8b1c9b3e8c4c5b2a',
  })
  @ViemAddressTransform()
  @IsOptional()
  refundRecipient?: Hex

  @ApiProperty({
    description: 'Address that will receive tokens on the destination chain',
    example: '0x8Ba1c0a8B4A4b9e8A9f1a6B7c8d9e0F1234567890',
  })
  @ViemAddressTransform()
  @IsNotEmpty()
  recipient: Hex
}
