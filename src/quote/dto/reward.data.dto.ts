import { RewardTokensType } from '@/quote/dto/types'
import { RewardType } from '@eco-foundation/routes-ts'
import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsEthereumAddress,
  IsNotEmpty,
  IsNumberString,
  ValidateNested,
} from 'class-validator'
import { Hex } from 'viem'

/**
 * The DTO for the intent reward data. Similar to {@link RewardType} except
 * that it does not contain the creator and tokens fields. Also has a modified
 * tokens field that is an array of {@link RewardTokensDTO} which include the
 * sender's willing token balance to use for the reward.
 * @param prover denotes the prover address
 * @param deadline denotes the deadline for the reward
 * @param nativeValue denotes the native token value of the reward
 * @param tokens denotes the array of {@link RewardTokensDTO} that the sender has
 */
export class RewardDataDTO implements Omit<RewardType, 'creator' | 'tokens'> {
  @IsEthereumAddress()
  @IsNotEmpty()
  @ApiProperty()
  prover: Hex

  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  deadline: bigint

  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  nativeValue: bigint

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => RewardTokensDTO)
  tokens: RewardTokensDTO[]
}

/**
 * The DTO for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 * @param balance denotes the amount of tokens the caller can send
 */
export class RewardTokensDTO implements RewardTokensType {
  @IsEthereumAddress()
  @IsNotEmpty()
  @ApiProperty()
  token: Hex

  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  balance: bigint
}
