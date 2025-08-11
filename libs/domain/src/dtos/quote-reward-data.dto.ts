import { ApiProperty } from '@nestjs/swagger'
import { plainToInstance, Transform, Type } from 'class-transformer'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteRewardTokensDTO } from './quote-reward-tokens.dto'

import type { Hex } from '@libs/shared'

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
export type QuoteRewardDataType = {
  creator: Hex
  prover: Hex
  deadline: bigint
  nativeValue: bigint
  tokens: QuoteRewardTokensDTO[]
}

export class QuoteRewardDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  creator: Hex

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