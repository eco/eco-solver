import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { Transform } from 'class-transformer'
import { IsEthereumAddress, IsInt, IsNotEmpty, IsString } from 'class-validator'

export class PermitDTO {
  @IsNotEmpty()
  @IsInt()
  @ApiProperty()
  chainID: number

  @IsNotEmpty()
  @ApiProperty()
  @IsEthereumAddress()
  funder: Hex

  @IsNotEmpty()
  @ApiProperty()
  @IsEthereumAddress()
  spender: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: Hex

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: Hex

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  deadline: bigint

  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  value: bigint
}
