import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Hex } from 'viem'
import { Type } from 'class-transformer'

export class BaseGaslessIntentRequestDTO {
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
