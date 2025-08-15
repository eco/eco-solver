import { ApiProperty } from '@nestjs/swagger'
import { GaslessIntentDataDTO } from './gasless-intent-data.dto'
import { Hex } from 'viem'
import { IsNotEmpty, ValidateNested, IsString } from 'class-validator'
import { plainToInstance, Type } from 'class-transformer'
import { QuoteRewardDataDTO } from './quote.reward.data.dto'
import { QuoteRouteDataDTO } from './quote.route.data.dto'

export class GaslessIntentRequestDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  quoteID!: string

  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  dAppID!: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  salt!: Hex

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  route!: QuoteRouteDataDTO

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => QuoteRewardDataDTO)
  reward!: QuoteRewardDataDTO

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData!: GaslessIntentDataDTO

  getSourceChainID?(): number {
    return Number(this.route.source)
  }

  getFunder?(): Hex {
    return this.gaslessIntentData.funder
  }

  getPermitContractAddress?(): Hex {
    return this.gaslessIntentData.getPermitContractAddress?.() as Hex
  }

  static fromJSON(json: any): GaslessIntentRequestDTO {
    return json.getFunder ? json : plainToInstance(GaslessIntentRequestDTO, json)
  }
}
