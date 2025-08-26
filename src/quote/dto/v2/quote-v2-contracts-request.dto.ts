import { ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsOptional } from 'class-validator'
import { ViemAddressTransform } from '@/transforms/viem-address.decorator'

export class QuoteV2ContractsRequestDTO {
  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  intentSource?: Hex

  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  prover?: Hex

  @ApiPropertyOptional()
  @ViemAddressTransform()
  @IsOptional()
  inbox?: Hex
}
