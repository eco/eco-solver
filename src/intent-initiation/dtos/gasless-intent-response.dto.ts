import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsString } from 'class-validator'

export class GaslessIntentResponseDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  chainID: number

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  transactionHash: Hex
}
