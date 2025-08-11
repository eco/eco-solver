export class QuoteDataDTO {
  @ApiProperty()
  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteDataEntryDTO)
  quoteEntries: QuoteDataEntryDTO[]
}
