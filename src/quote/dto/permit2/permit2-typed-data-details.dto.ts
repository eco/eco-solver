import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsEthereumAddress, IsNotEmpty, IsNumberString } from 'class-validator'
import { Transform } from 'class-transformer'

export class Permit2TypedDataDetailsDTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  amount: bigint

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  expiration: string // string of a UNIX seconds since epoch integer

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  nonce: string
}
