
import { ApiProperty } from '@nestjs/swagger'
import { Type, Transform } from 'class-transformer'
import { Hex } from 'viem'
import {
  IsNotEmpty,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
  IsEthereumAddress,
} from 'class-validator'

export class Permit2BatchTypedDataDTO {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => Permit2TypedDataDetailsDTO)
  details: Permit2TypedDataDetailsDTO[]

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  spender: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  sigDeadline: bigint // string of a UNIX seconds since epoch integer
}
