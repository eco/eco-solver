import { ApiProperty } from '@nestjs/swagger'
import { getAddress, Hex } from 'viem'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { plainToInstance, Transform, Type } from 'class-transformer'
import { RewardTokensInterface } from '@eco-solver/contracts'
import { RewardType } from '@eco-foundation/routes-ts'
import { ViemAddressTransform } from '@eco-solver/transforms/viem-address.decorator'

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
  creator: Hex

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
  @ValidateNested()
  @ApiProperty()
  @Type(() => QuoteRewardTokensDTO)
  tokens: QuoteRewardTokensDTO[]

  hasToken?(token: Hex): boolean {
    return this.tokens.some((t) => t.token.toLowerCase() === token.toLowerCase())
  }

  static fromJSON(json: any): QuoteRewardDataDTO {
    return json.hasToken ? json : plainToInstance(QuoteRewardDataDTO, json)
  }
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
type QuoteRewardType = RewardType
export type QuoteRewardDataType = QuoteRewardType
