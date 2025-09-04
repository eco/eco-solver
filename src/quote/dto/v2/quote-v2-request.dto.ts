import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { GaslessIntentDataV2DTO } from '@/quote/dto/v2/gasless-intent-data-v2.dto'
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

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional({
    description:
      'Optional gasless intent data containing permit signatures for token approvals and execution configuration',
    type: () => GaslessIntentDataV2DTO,
  })
  @Type(() => GaslessIntentDataV2DTO)
  gaslessIntentData?: GaslessIntentDataV2DTO
}
