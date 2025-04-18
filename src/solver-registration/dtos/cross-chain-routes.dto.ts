import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CrossChainRoutesConfigDTO } from './cross-chain-routes-config.dto'
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator'

export class CrossChainRoutesDTO {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  useTokenEnums?: boolean = false

  @ApiProperty()
  @IsNotEmpty()
  crossChainRoutesConfig: CrossChainRoutesConfigDTO
}
