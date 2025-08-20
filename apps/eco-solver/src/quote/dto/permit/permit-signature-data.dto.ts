import { ApiProperty } from '@nestjs/swagger'
import { Hex } from "viem"
import { IsNotEmpty, IsString } from 'class-validator'
import { Transform } from 'class-transformer'

export class PermitSignatureDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  deadline: bigint // UNIX seconds since epoch integer
}
