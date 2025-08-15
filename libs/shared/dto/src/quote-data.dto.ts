import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class QuoteDataEntryDTO {
  @ApiProperty()
  executionType!: string

  @ApiProperty()
  estimatedGas!: string

  @ApiProperty()
  quoteID!: string
}

export class QuoteDataDTO {
  @ApiProperty()
  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteDataEntryDTO)
  quoteEntries!: QuoteDataEntryDTO[]
}