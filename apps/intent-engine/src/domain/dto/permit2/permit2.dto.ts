export class Permit2DTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  permitContract: Hex

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2DataDTO)
  permitData: Permit2DataDTO // SinglePermitData | BatchPermitData permit2 data required for permit call to the permit2 contract

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: Hex // signed permit2 data
}
