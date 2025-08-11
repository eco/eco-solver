import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

// This should be imported from shared types when available
type Hex = `0x${string}`

export class GaslessIntentResponseDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  transactionHash: Hex
}