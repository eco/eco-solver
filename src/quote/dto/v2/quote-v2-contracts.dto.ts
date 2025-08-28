import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsString } from 'class-validator'

export class QuoteV2ContractsDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  intentSource: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  prover: Hex

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  inbox: Hex
}
