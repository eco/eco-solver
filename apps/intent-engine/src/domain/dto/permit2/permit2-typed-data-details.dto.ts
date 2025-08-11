export class Permit2TypedDataDetailsDTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: Hex

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  amount: string // string of a bigint

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  expiration: string // string of a UNIX seconds since epoch integer

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  nonce: string // string of a bigint
}
