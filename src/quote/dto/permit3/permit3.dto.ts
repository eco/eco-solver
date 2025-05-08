import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import {
  ArrayNotEmpty,
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsString,
} from 'class-validator'
import { Transform } from 'class-transformer'

export class AllowanceOrTransferDTO {
  @IsInt()
  @ApiProperty()
  chainID: number // The original chain ID from the signature

  @IsInt()
  @ApiProperty()
  modeOrExpiration: number

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  account: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  amountDelta: bigint
}

export class Permit3DTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  permitContract: Hex

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: string

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  deadline: bigint

  @IsInt()
  @ApiProperty()
  chainId: number // The original chain ID from the signature

  @IsArray()
  @ArrayNotEmpty()
  @ApiProperty()
  leafs: Hex[] // The original chain ID from the signature

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  owner: Hex

  @IsNotEmpty()
  @ApiProperty()
  salt: Hex

  @IsInt()
  @ApiProperty()
  timestamp: number

  // Store all permits by chain ID for easy filtering
  allowanceOrTransfers: AllowanceOrTransferDTO[]
}
