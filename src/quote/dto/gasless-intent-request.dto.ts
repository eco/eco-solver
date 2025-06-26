import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { GaslessIntentDataDTO } from '@/quote/dto/gasless-intent-data.dto'
import { Hex } from 'viem'
import { Type } from 'class-transformer'

export class GaslessIntentRequestDTO {
  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  intentGroupID: string

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
  @IsString()
  @ApiProperty()
  salt: Hex
}
