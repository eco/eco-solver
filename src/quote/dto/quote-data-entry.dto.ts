import { ApiProperty } from '@nestjs/swagger'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
import { RewardTokensInterface } from '@/contracts'
import { Type } from 'class-transformer'

export class QuoteDataEntryDTO {
  @ApiProperty({ enum: IntentExecutionType.enumKeys })
  @IsString()
  @IsIn(IntentExecutionType.enumKeys)
  @IsNotEmpty()
  intentExecutionType: string

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  route: QuoteRouteDataDTO

  @IsNotEmpty()
  @IsArray()
  @ApiProperty()
  tokens: RewardTokensInterface[]

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  expiryTime: string
}
