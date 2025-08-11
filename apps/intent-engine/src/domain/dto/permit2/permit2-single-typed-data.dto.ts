export class Permit2SingleTypedDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2TypedDataDetailsDTO)
  details: Permit2TypedDataDetailsDTO

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  spender: Hex // want to validate that this is the correct spender (no free permits)

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  sigDeadline: bigint // string of a UNIX seconds since epoch integer
}
