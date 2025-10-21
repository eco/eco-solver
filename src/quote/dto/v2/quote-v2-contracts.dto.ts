import { Address } from 'viem'
import { ApiProperty } from '@nestjs/swagger'
import { IsEthereumAddress, IsNotEmpty } from 'class-validator'

export class QuoteV2ContractsDTO {
  @ApiProperty({
    description: 'Contract address for the intent source (where intents are created and managed)',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  sourcePortal: Address

  @ApiProperty({
    description: 'Contract address for the inbox (receives and processes cross-chain messages)',
    example: '0x567890abcdef1234567890abcdef1234567890ab',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  destinationPortal: Address

  @ApiProperty({
    description: 'Contract address for the prover (handles cross-chain proof verification)',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  prover: Address
}
