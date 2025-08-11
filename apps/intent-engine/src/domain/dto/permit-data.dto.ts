export class PermitDataDTO {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDTO)
  permit?: PermitDTO[]

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => Permit2DTO)
  permit2?: Permit2DTO

  getPermitContractAddress?(): Hex {
    return (this.permit ? zeroAddress : this.permit2!.permitContract) as Hex
  }
}
