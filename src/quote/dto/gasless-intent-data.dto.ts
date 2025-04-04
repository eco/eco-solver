import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { PermitDataDTO } from '@/quote/dto/permit-data.dto'
import { Type } from 'class-transformer'

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

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => PermitDataDTO)
  permitData: PermitDataDTO

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  allowPartial?: boolean = false

  getPermitContractAddress?(): Hex {
    return this.permitData.getPermitContractAddress?.() as Hex
  }
}
