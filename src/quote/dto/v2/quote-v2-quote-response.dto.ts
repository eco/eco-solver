import { Address, Hex } from 'viem'
import { ApiProperty } from '@nestjs/swagger'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import {
  IsArray,
  IsEthereumAddress,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator'
import { QuoteV2FeeDTO } from '@/quote/dto/v2/quote-v2-fee.dto'
import { Type } from 'class-transformer'

export class QuoteV2QuoteResponseDTO {
  @ApiProperty({
    enum: IntentExecutionType.enumKeys,
    description: 'The execution type for this quote entry',
    example: 'SELF_PUBLISH',
  })
  @IsString()
  @IsNotEmpty()
  intentExecutionType: string

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
  @IsNotEmpty()
  @IsEthereumAddress()
  sourceToken: Hex

  @ApiProperty({
    description: 'Contract address of the token to be received on the destination chain',
    example: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  destinationToken: Hex

  @ApiProperty({
    description: 'Amount of source tokens to send, as a string representation of a bigint',
    example: '1000000',
  })
  @IsNotEmpty()
  @IsString()
  sourceAmount: string

  @ApiProperty({
    description:
      'Amount of destination tokens to be received, as a string representation of a bigint',
    example: '995000',
  })
  @IsNotEmpty()
  @IsString()
  destinationAmount: string

  @ApiProperty({
    description: 'Address that will provide the tokens and pay for the transaction',
    example: '0x742d35Cc6527C92b4A1F3a2a8b1c9b3e8c4c5b2a',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  funder: Address

  @ApiProperty({
    description: 'Address to receive refunds if the intent fails',
    example: '0x742d35Cc6527C92b4A1F3a2a8b1c9b3e8c4c5b2a',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  refundRecipient: Address

  @ApiProperty({
    description: 'Address that will receive the tokens on the destination chain',
    example: '0x8Ba1c0a8B4A4b9e8A9f1a6B7c8d9e0F1234567890',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  recipient: Address

  @ApiProperty({
    description: 'Array of fees that will be charged for executing this cross-chain swap',
    type: [QuoteV2FeeDTO],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteV2FeeDTO)
  fees: QuoteV2FeeDTO[]

  @ApiProperty({
    description:
      'Unix timestamp (in seconds) after which this quote expires and cannot be executed',
    example: 1672531200,
  })
  @IsNotEmpty()
  @IsNumber()
  deadline: number

  @ApiProperty({
    description: 'Estimated time in seconds for the cross-chain swap to be completed',
    example: 300,
  })
  @IsNotEmpty()
  @IsNumber()
  estimatedFulfillTimeSec: number
}
