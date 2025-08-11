import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNotEmpty } from 'class-validator'

// This should be imported from shared types when available
type Hex = `0x${string}`

export interface RewardTokensInterface {
  token: Hex
  amount: bigint
}

/**
 * The DTO for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 * @param balance denotes the amount of tokens the caller can send
 */
export class QuoteRewardTokensDTO implements RewardTokensInterface {
  @IsNotEmpty()
  @ApiProperty()
  token: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  amount: bigint
}