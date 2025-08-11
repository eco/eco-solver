
import { Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsEthereumAddress,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex, zeroAddress } from 'viem'
import { PermitDataDTO } from './permit-data.dto'

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
