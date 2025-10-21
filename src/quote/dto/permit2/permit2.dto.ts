import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'

export class Permit2DTO {
  @IsNotEmpty()
  @IsInt()
  @ApiProperty()
  chainID: number

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  permitContract: Hex

  @IsArray()
  @ArrayNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2TypedDataDetailsDTO)
  details: Permit2TypedDataDetailsDTO[]

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  funder: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  spender: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  sigDeadline: bigint // string of a UNIX seconds since epoch integer

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: Hex // signed permit2 data
}
