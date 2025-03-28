import { ApiProperty } from '@nestjs/swagger'
import { TokenAmountDataDTO } from './token-amount-data.dto'
import { Type } from 'class-transformer'

import {
  IsNotEmpty,
  IsString,
  IsEthereumAddress,
  IsNumberString,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator'

export class RewardDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  @IsEthereumAddress()
  creator: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  @IsEthereumAddress()
  prover: string

  @IsNotEmpty()
  @IsString()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  deadline: string

  @IsNotEmpty()
  @IsString()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  nativeValue: string

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => TokenAmountDataDTO)
  tokens: TokenAmountDataDTO[]
}
