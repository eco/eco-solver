import { ApiProperty } from '@nestjs/swagger'
import { plainToInstance, Type } from 'class-transformer'
import { IsString, IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteRouteDataDTO } from './quote-route-data.dto'
import { QuoteRewardDataDTO } from './quote-reward-data.dto'
import { GaslessIntentDataDTO } from './gasless-intent-data.dto'

// This should be imported from shared types when available
type Hex = `0x${string}`

export class GaslessIntentRequestDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  quoteID: string

  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  dAppID: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  salt: Hex

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

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData: GaslessIntentDataDTO

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