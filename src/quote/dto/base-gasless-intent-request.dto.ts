import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Hex } from 'viem'
import { Type } from 'class-transformer'

export class BaseGaslessIntentRequestDTO {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Unique identifier for this group of intents',
    example: 'intent-group:abc123',
  })
  @IsString()
  intentGroupID: string

  @IsNotEmpty()
  @ApiProperty({
    description: 'Identifier of the dApp initiating the intent',
    example: 'my-dapp-id',
  })
  @IsString()
  dAppID: string

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty({
    description: 'Array of intents to execute in this group',
    type: () => [IntentDTO],
  })
  @ValidateNested()
  @Type(() => IntentDTO)
  intents: IntentDTO[]
}

export class IntentDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Reference to the quote this intent is based on',
    example: 'quote:966ee977-586b-4bca-abf1-e7def508a19c',
  })
  quoteID: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Unique salt for intent hash generation',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  salt: Hex
}
