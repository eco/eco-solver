import { ApiProperty } from '@nestjs/swagger'
import { getAddress, Hex } from 'viem'
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { plainToInstance, Transform, Type } from 'class-transformer'
import { RewardTokensInterface } from '@/contracts'
import { RewardType } from '@eco-foundation/routes-ts'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'

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
  @ApiProperty({
    description: 'Address of the intent creator',
    example: '0x742d35Cc6527C92b4A1F3a2a8b1c9b3e8c4c5b2a',
  })
  creator: Hex

  @ViemAddressTransform()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Address authorized to prove intent fulfillment',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  prover: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty({
    description: 'Unix timestamp (seconds) when the reward expires',
    example: '1672531200',
  })
  deadline: bigint

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty({
    description: 'Amount of native token (wei) included in reward',
    example: '0',
  })
  nativeValue: bigint

  @IsArray()
  @ValidateNested()
  @ApiProperty({
    description: 'Array of ERC20 tokens included in the reward',
    type: () => [QuoteRewardTokensDTO],
  })
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
  @ApiProperty({
    description: 'ERC20 token contract address',
    example: '0xA0b86a33E6441e45C3b9d1C3D6a0b5be4b7b5b5a',
  })
  @Transform(({ value }) => getAddress(value))
  token: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty({
    description: 'Token amount (in smallest unit/wei) for the reward',
    example: '1000000',
  })
  amount: bigint
}
type QuoteRewardType = RewardType
export type QuoteRewardDataType = QuoteRewardType
