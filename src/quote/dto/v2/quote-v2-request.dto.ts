import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { QuoteV2ContractsRequestDTO } from '@/quote/dto/v2/quote-v2-contracts-request.dto'
import { QuoteV2QuoteRequestDTO } from '@/quote/dto/v2/quote-v2-quote-request.dto'
import { Type } from 'class-transformer'

export class QuoteV2RequestDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  dAppID: string

  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2QuoteRequestDTO)
  quoteRequest: QuoteV2QuoteRequestDTO

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteV2ContractsRequestDTO)
  contracts?: QuoteV2ContractsRequestDTO
}
