import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteV2ContractsDTO } from '@/quote/dto/v2/quote-v2-contracts.dto'
import { QuoteV2QuoteResponseDTO } from '@/quote/dto/v2/quote-v2-quote-response.dto'
import { Type } from 'class-transformer'

export class QuoteV2ResponseDTO {
  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2QuoteResponseDTO)
  quoteResponses: QuoteV2QuoteResponseDTO[]

  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2ContractsDTO)
  contracts: QuoteV2ContractsDTO
}
