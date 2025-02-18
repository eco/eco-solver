import { RewardTokensInterface } from '@/contracts'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'
import { RewardType } from '@eco-foundation/routes-ts'
import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { getAddress, Hex } from 'viem'

/**
 * The DTO for the intent reward data. Similar to {@link RewardType} except
 * that it does not contain the creator and tokens fields. Also has a modified
 * tokens field that is an array of {@link QuoteRewardTokensDTO} which include the
 * sender's willing token balance to use for the reward.
 * @param prover denotes the prover address
 * @param deadline denotes the deadline for the reward
 * @param nativeValue denotes the native token value of the reward
 * @param tokens denotes the array of {@link QuoteRewardTokensDTO} that the sender has
 */
export class QuoteRewardDataDTO implements QuoteRewardDataType {
  @ViemAddressTransform()
  @IsNotEmpty()
  @ApiProperty()
  prover: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  deadline: bigint

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  nativeValue: bigint

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => QuoteRewardTokensDTO)
  tokens: QuoteRewardTokensDTO[]
}

/**
 * The DTO for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 * @param balance denotes the amount of tokens the caller can send
 */
export class QuoteRewardTokensDTO implements RewardTokensInterface {
  @ViemAddressTransform()
  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => getAddress(value))
  token: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  amount: bigint
}
type QuoteRewardType = Omit<RewardType, 'creator'>
export type QuoteRewardDataType = QuoteRewardType
