export class Permit2DataDTO {
  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => SinglePermitDataDTO)
  singlePermitData?: SinglePermitDataDTO

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => BatchPermitDataDTO)
  batchPermitData?: BatchPermitDataDTO

  getDetails(): Permit2TypedDataDetailsDTO[] {
    if (this.singlePermitData) {
      return [this.singlePermitData.typedData.details]
    }

    return this.batchPermitData!.typedData.details
  }

  getSpender(): Hex {
    if (this.singlePermitData) {
      return this.singlePermitData.typedData.spender
    }

    return this.batchPermitData!.typedData.spender
  }

  getSigDeadline(): bigint {
    if (this.singlePermitData) {
      return this.singlePermitData.typedData.sigDeadline
    }

    return this.batchPermitData!.typedData.sigDeadline
  }
}
