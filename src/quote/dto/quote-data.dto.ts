import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'
import { Type } from 'class-transformer'

export class QuoteDataDTO {
  @ApiProperty({
    description: 'Array of quote entries, one for each requested execution type',
    type: [QuoteDataEntryDTO],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteDataEntryDTO)
  quoteEntries: QuoteDataEntryDTO[]
}
