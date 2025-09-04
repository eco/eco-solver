import { AllowanceOrTransferDTO } from '@/quote/dto/permit3/allowance-or-transfer.dto.ts'
import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayNotEmpty,
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Hex } from 'viem'
import { Transform, Type } from 'class-transformer'

export class Permit3DTO {
  @IsInt()
  @ApiProperty({
    description: 'The original chain ID from the signature',
    example: 1,
  })
  chainId: number

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty({
    description: 'Address of the Permit3 contract',
    example: '0x1234567890123456789012345678901234567890',
  })
  permitContract: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty({
    description: 'Owner address of the tokens being permitted',
    example: '0x0987654321098765432109876543210987654321',
  })
  owner: Hex

  @IsNotEmpty()
  @ApiProperty({
    description: 'Unique salt value for the permit signature',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  salt: Hex

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Cryptographic signature for the permit',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
  })
  signature: string

  @IsNotEmpty()
  @ApiProperty({
    description: 'Expiration timestamp for the permit signature',
    example: 1234567890,
  })
  @Transform(({ value }) => BigInt(value))
  deadline: bigint

  @IsInt()
  @ApiProperty({
    description: 'Unix timestamp when the permit was created',
    example: 1234567890,
  })
  timestamp: number

  @IsArray()
  @ArrayNotEmpty()
  @ApiProperty({
    description: 'Array of merkle tree leaf hashes for multi-chain permits',
    example: [
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    ],
  })
  leafs: Hex[] // The original chain ID from the signature

  // Store all permits by chain ID for easy filtering
  @IsArray()
  @ArrayNotEmpty()
  @ApiProperty({
    description: 'Array of allowance or transfer data organized by chain for multi-chain permits',
    type: [AllowanceOrTransferDTO],
  })
  @ValidateNested({ each: true })
  @Type(() => AllowanceOrTransferDTO)
  allowanceOrTransfers: AllowanceOrTransferDTO[]
}
