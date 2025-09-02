import { Address } from 'viem'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEthereumAddress, IsOptional } from 'class-validator'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'

export class QuoteV2ContractsRequestDTO {
  @ApiPropertyOptional({
    description: 'Contract address for the intent source (where intents are created and managed)',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsOptional()
  @ViemAddressTransform()
  @IsEthereumAddress()
  sourcePortal?: Address

  @ApiPropertyOptional({
    description: 'Contract address for the inbox (receives and processes cross-chain messages)',
    example: '0x567890abcdef1234567890abcdef1234567890ab',
  })
  @IsOptional()
  @ViemAddressTransform()
  @IsEthereumAddress()
  destinationPortal?: Address

  @ApiPropertyOptional({
    description: 'Contract address for the prover (handles cross-chain proof verification)',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  @IsOptional()
  @ViemAddressTransform()
  @IsEthereumAddress()
  prover?: Address
}
