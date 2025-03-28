import { ApiProperty } from '@nestjs/swagger'
import { IsEthereumAddress, IsNotEmpty, IsNumberString, IsString } from 'class-validator'

export class TokenAmountDataDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  @IsEthereumAddress()
  token: string

  @IsNotEmpty()
  @IsString()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  amount: string
}
