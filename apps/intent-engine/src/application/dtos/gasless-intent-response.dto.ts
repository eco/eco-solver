import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'

export class GaslessIntentResponseDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  transactionHash: Hex
}
