export class PermitDTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: Hex // permit supported ERC20 to call 'permit' on, also the reward token to match up with

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => PermitSignatureDTO)
  data: PermitSignatureDTO
}
