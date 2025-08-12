import { CallDataInterface } from '@/contracts'
import { ParsedCalls } from '@/intent/utils/normalize-calls.utils'
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
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  source: bigint

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  destination: bigint

  @ViemAddressTransform()
  @IsNotEmpty()
  @ApiProperty()
  inbox: Hex

  @IsArray()
  @ValidateNested()
  @ApiProperty()
  @Type(() => QuoteRewardTokensDTO)
  tokens: QuoteRewardTokensDTO[]

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiProperty()
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

export interface QuoteRouteDataInterface extends Omit<RouteType, 'salt'> {
  parsedCalls?: ParsedCalls
}
