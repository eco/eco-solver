import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class SolverRegistrationDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesUrl: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiveSignedIntentUrl: string
}
