import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNotEmpty } from 'class-validator'

// This should be imported from shared types when available
type Hex = `0x${string}`

export interface CallDataInterface {
  target: Hex
  data: Hex
  value: bigint
}

/**
 * The DTO for the call data that the sender wants to make.
 * @param target denotes the target address of the call
 * @param data denotes the data of the call
 * @param value denotes the native token value of the call
 */
export class QuoteCallDataDTO implements CallDataInterface {
  @IsNotEmpty()
  @ApiProperty()
  target: Hex

  @IsNotEmpty()
  @ApiProperty()
  data: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  value: bigint
}