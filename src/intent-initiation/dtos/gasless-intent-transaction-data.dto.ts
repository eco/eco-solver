import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class GaslessIntentTransactionDataDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  intentGroupID: string

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional()
  destinationChainID?: number

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  destinationChainTxHash?: Hex
}
