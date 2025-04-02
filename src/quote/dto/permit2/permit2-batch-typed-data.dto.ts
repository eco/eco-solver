import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { Permit2TypedDataDetailsDTO } from './permit2-typed-data-details.dto'
import { Type } from 'class-transformer'

import {
  IsNotEmpty,
  IsNumberString,
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
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  sigDeadline: string // string of a UNIX seconds since epoch integer
}
