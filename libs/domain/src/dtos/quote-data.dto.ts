import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { QuoteDataEntryDTO } from './quote-data-entry.dto'

export class QuoteDataDTO {
  @ApiProperty()
  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteDataEntryDTO)
  quoteEntries: QuoteDataEntryDTO[]
}