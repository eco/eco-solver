import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsNotEmpty, ValidateNested } from 'class-validator'
import { QuoteRewardTokensDTO } from './quote-reward-tokens.dto'
import { QuoteCallDataDTO } from './quote-call-data.dto'

// This should be imported from shared types when available
type Hex = `0x${string}`

/**
 * The DTO for the route data that the sender wants to make.
 * Similar to {@link RouteType} except that it does not contain the salt field.
 * @param source denotes the source chain id of the route
 * @param destination denotes the destination chain id of the route
 * @param inbox denotes the inbox address
 * @param calls denotes the array of {@link QuoteCallDataDTO} that the sender wants to make
 */
export class QuoteRouteDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @Transform(({ value }) => BigInt(value))
  source: bigint

  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  @ApiProperty()
  destination: bigint

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