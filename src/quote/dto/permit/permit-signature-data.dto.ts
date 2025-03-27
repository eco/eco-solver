import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, IsNumberString } from 'class-validator'

export class PermitSignatureDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: string

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  deadline: string // UNIX seconds since epoch integer
}
