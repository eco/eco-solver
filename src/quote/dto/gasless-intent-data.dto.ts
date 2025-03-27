import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PermitDataDTO } from './permit-data.dto'
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
  funder: string

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => PermitDataDTO)
  permitData: PermitDataDTO

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  allowPartial?: boolean = false
}
