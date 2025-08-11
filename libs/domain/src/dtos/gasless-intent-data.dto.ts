import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsEthereumAddress,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator'

// This should be imported from shared types when available
type Hex = `0x${string}`

// Placeholder for PermitDataDTO - should be imported from appropriate module
class PermitDataDTO {
  getPermitContractAddress?(): Hex
}

// Placeholder for zeroAddress - should be imported from shared constants
const zeroAddress = '0x0000000000000000000000000000000000000000' as Hex

export class GaslessIntentDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @IsEthereumAddress()
  funder: Hex

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDataDTO)
  permitData?: PermitDataDTO

  @IsOptional()
  @ApiProperty()
  @IsEthereumAddress()
  vaultAddress?: Hex

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  allowPartial = false

  getPermitContractAddress?(): Hex {
    return this.permitData ? (this.permitData.getPermitContractAddress?.() as Hex) : zeroAddress
  }
}