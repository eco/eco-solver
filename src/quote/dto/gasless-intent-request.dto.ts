import { ApiProperty } from '@nestjs/swagger'
import { GaslessIntentDataDTO } from './gasless-intent-data.dto'
import { IsNotEmpty, ValidateNested, IsString } from 'class-validator'
import { RewardDTO } from './reward.dto'
import { Type } from 'class-transformer'

export class GaslessIntentRequestDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  routeHash: string

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
}
