import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteDataEntryDTO } from '@eco-solver/quote/dto/quote-data-entry.dto'
import { Type } from 'class-transformer'

export class QuoteDataDTO {
  @ApiProperty()
  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteDataEntryDTO)
  quoteEntries: QuoteDataEntryDTO[]
}
