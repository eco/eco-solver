import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsEthereumAddress, IsNotEmpty, ValidateNested } from 'class-validator'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'
import { Transform, Type } from 'class-transformer'

export class Permit2SingleTypedDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2TypedDataDetailsDTO)
  details: Permit2TypedDataDetailsDTO

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  spender: Hex // want to validate that this is the correct spender (no free permits)

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  sigDeadline: bigint // string of a UNIX seconds since epoch integer
}
