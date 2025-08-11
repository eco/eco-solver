export class SinglePermitDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2SingleTypedDataDTO)
  typedData: Permit2SingleTypedDataDTO
}
