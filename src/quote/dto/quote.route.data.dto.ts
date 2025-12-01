import { CallDataInterface } from '@/contracts'
import { QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'
import { RouteType } from '@eco-foundation/routes-ts'
import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { Hex } from 'viem'

/**
 * The DTO for the route data that the sender wants to make.
 * Similar to {@link RouteType} except that it does not contain the salt field.
 * @param source denotes the source chain id of the route
 * @param destination denotes the destination chain id of the route
 * @param inbox denotes the inbox address
 * @param calls denotes the array of {@link QuoteCallDataDTO} that the sender wants to make
 */
export class QuoteRouteDataDTO implements QuoteRouteDataInterface {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Source chain ID where the transaction originates',
    example: '1',
  })
  @Transform(({ value }) => BigInt(value))
  source: bigint

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty({
    description: 'Destination chain ID where tokens will be received',
    example: '42161',
  })
  destination: bigint

  @ViemAddressTransform()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Inbox contract address on destination chain',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  inbox: Hex

  @IsArray()
  @ValidateNested()
  @ApiProperty({
    description: 'Array of tokens involved in the route',
    type: [QuoteRewardTokensDTO],
  })
  @Type(() => QuoteRewardTokensDTO)
  tokens: QuoteRewardTokensDTO[]

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty({
    description: 'Array of contract calls to execute on destination chain',
    type: () => [QuoteCallDataDTO],
  })
  @Type(() => QuoteCallDataDTO)
  calls: QuoteCallDataDTO[]
}

/**
 * The DTO for the call data that the sender wants to make.
 * @param target denotes the target address of the call
 * @param data denotes the data of the call
 * @param value denotes the native token value of the call
 */
export class QuoteCallDataDTO implements CallDataInterface {
  @ViemAddressTransform()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Target contract address for the call',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  target: Hex

  @IsNotEmpty()
  @ApiProperty({
    description: 'Encoded calldata for the contract interaction',
    example: '0x095ea7b3000000000000000000000000',
  })
  data: Hex

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty({
    description: 'Native token value (wei) to send with the call',
    example: '0',
  })
  value: bigint
}

export interface QuoteRouteDataInterface extends Omit<RouteType, 'salt'> {}
