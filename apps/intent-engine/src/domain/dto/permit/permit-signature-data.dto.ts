export class PermitSignatureDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  deadline: bigint // UNIX seconds since epoch integer
}
