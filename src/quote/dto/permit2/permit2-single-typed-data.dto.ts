import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEthereumAddress, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator'
import { Permit2TypedDataDetailsDTO } from './permit2-typed-data-details.dto'

export class Permit2SingleTypedDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2TypedDataDetailsDTO)
  details: Permit2TypedDataDetailsDTO

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  spender: string // want to validate that this is the correct spender (no free permits)

  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @ApiProperty()
  sigDeadline: string // string of a UNIX seconds since epoch integer
}
