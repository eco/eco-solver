import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import {
  ArrayNotEmpty,
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'

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
  @IsInt()
  @ApiProperty()
  chainId: number // The original chain ID from the signature

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  permitContract: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  owner: Hex

  @IsNotEmpty()
  @ApiProperty()
  salt: Hex

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
  timestamp: number

  @IsArray()
  @ArrayNotEmpty()
  @ApiProperty()
  leafs: Hex[] // The original chain ID from the signature

  // Store all permits by chain ID for easy filtering
  @ApiProperty()
  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AllowanceOrTransferDTO)
  allowanceOrTransfers: AllowanceOrTransferDTO[]
}
