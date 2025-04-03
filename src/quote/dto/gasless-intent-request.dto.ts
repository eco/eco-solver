import { ApiProperty } from '@nestjs/swagger'
import { GaslessIntentDataDTO } from './gasless-intent-data.dto'
import { Hex } from 'viem'
import { IsNotEmpty, ValidateNested, IsString } from 'class-validator'
import { plainToInstance, Type } from 'class-transformer'
import { QuoteRouteDataDTO } from './quote.route.data.dto'
import { RewardDTO } from './reward.dto'

export class GaslessIntentRequestDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  originChainID: number

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  destinationChainID: number

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
  @Type(() => RewardDTO)
  reward: RewardDTO

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData: GaslessIntentDataDTO

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
