import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteV2ContractsDTO } from '@/quote/dto/v2/quote-v2-contracts.dto'
import { QuoteV2QuoteResponseDTO } from '@/quote/dto/v2/quote-v2-quote-response.dto'
import { Type } from 'class-transformer'

export class QuoteV2ResponseDTO {
  @ApiProperty({
    description: 'Array of quote responses, one for each requested execution type',
    type: [QuoteV2QuoteResponseDTO],
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2QuoteResponseDTO)
  quoteResponses: QuoteV2QuoteResponseDTO[]

  @ApiProperty({
    description: 'Contract addresses required for intent execution',
    type: () => QuoteV2ContractsDTO,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2ContractsDTO)
  contracts: QuoteV2ContractsDTO
}
