import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class GaslessIntentTransactionDataDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Unique identifier for the intent group',
    example: 'intent-group:abc123',
  })
  intentGroupID: string

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    description: 'Chain ID where the intent was fulfilled',
    example: 42161,
  })
  destinationChainID?: number

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Transaction hash on the destination chain',
    example: '0xdef456...',
  })
  destinationChainTxHash?: Hex
}
