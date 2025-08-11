export class BatchPermitDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2BatchTypedDataDTO)
  typedData: Permit2BatchTypedDataDTO
}
