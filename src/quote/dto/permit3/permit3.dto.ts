import { AllowanceOrTransferDTO } from '@/quote/dto/permit3/allowance-or-transfer.dto'
import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayNotEmpty,
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator'
import { Hex } from 'viem'
import { Transform, Type } from 'class-transformer'

export class Permit3DTO {
  @IsInt()
  @ApiProperty({
    description: 'The original chain ID where the request is being signed or executed',
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
    description: 'Unique salt value used for EIP-712 signature and nonce tracking',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  salt: Hex

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'EIP-712 cryptographic signature from the token owner',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
  })
  signature: Hex

  @IsNotEmpty()
  @ApiProperty({
    description: 'Expiration timestamp for the permit signature (uint48)',
    example: 1699999999,
  })
  @Transform(({ value }) => BigInt(value))
  deadline: bigint

  @IsInt()
  @ApiProperty({
    description: 'Unix timestamp when the permit was created (uint48)',
    example: 1699988888,
  })
  timestamp: number

  @IsNotEmpty()
  @Matches(/^0x[0-9a-fA-F]{64}$/, {
    message: 'merkleRoot must be a valid bytes32 string',
  })
  @ApiProperty({
    description: 'Merkle root hash representing all chain permit leaves',
    example: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  })
  merkleRoot: Hex

  @IsOptional()
  @IsArray()
  @ApiProperty({
    description:
      'Optional array of Merkle tree leaves (hashed ChainPermits), useful for client-side debugging or proof regeneration',
    example: [
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    ],
  })
  leaves: Hex[]

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AllowanceOrTransferDTO)
  @ApiProperty({
    description:
      'Flattened list of all permits across chains used to construct ChainPermits and Merkle tree leaves',
    type: [AllowanceOrTransferDTO],
  })
  allowanceOrTransfers: AllowanceOrTransferDTO[]
}
