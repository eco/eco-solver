import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsString, IsNumberString } from 'class-validator'
import { Transform } from 'class-transformer'

export class PermitSignatureDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: Hex

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  deadline: bigint // UNIX seconds since epoch integer
}
