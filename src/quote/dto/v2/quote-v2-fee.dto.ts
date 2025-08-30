import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { QuoteV2TokenDTO } from '@/quote/dto/v2/quote-v2-token.dto'
import { Type } from 'class-transformer'

export class QuoteV2FeeDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string

  @ApiProperty()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteV2TokenDTO)
  token: QuoteV2TokenDTO

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  amount: string
}
