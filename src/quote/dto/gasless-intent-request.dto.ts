import { ApiProperty } from '@nestjs/swagger'
import { GaslessIntentDataDTO } from '@/quote/dto/gasless-intent-data.dto'
import { Hex } from 'viem'
import { IsNotEmpty, ValidateNested, IsString, ArrayNotEmpty, IsArray } from 'class-validator'
import { plainToInstance, Type } from 'class-transformer'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'

export class GaslessIntentRequestDTO {
  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  dAppID: string

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @ValidateNested()
  @Type(() => IntentDTO)
  intents: IntentDTO[]

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData: GaslessIntentDataDTO
}

export class IntentDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  quoteID: string

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  route: QuoteRouteDataDTO

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => QuoteRewardDataDTO)
  reward: QuoteRewardDataDTO
}
