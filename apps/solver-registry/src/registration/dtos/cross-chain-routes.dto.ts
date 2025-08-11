export class CrossChainRoutesDTO {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  useTokenEnums?: boolean = false

  @ApiProperty()
  @IsNotEmpty()
  crossChainRoutesConfig: CrossChainRoutesConfigDTO
}
