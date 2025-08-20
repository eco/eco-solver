import { ApiProperty } from '@nestjs/swagger'
import { Hex } from "viem"
import { Permit2TypedDataDetailsDTO } from '@eco-solver/quote/dto/permit2/permit2-typed-data-details.dto'
import { Transform, Type } from 'class-transformer'

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
