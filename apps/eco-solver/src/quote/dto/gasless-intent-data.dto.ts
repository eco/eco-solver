import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from "viem"
import { PermitDataDTO } from '@eco-solver/quote/dto/permit-data.dto'
import { Type } from 'class-transformer'
import { zeroAddress } from "viem"

import {
  IsNotEmpty,
  IsEthereumAddress,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator'

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
