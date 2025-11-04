import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

import { CrossChainRoutesConfigDTO } from './cross-chain-routes-config.dto';

export class CrossChainRoutesDTO {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  useTokenEnums?: boolean = false;

  @ApiProperty()
  @IsNotEmpty()
  crossChainRoutesConfig: CrossChainRoutesConfigDTO;
}
