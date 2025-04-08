import { ApiProperty } from '@nestjs/swagger'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
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
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRewardDataDTO)
  reward: QuoteRewardDataDTO

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  expiryTime: string
}
