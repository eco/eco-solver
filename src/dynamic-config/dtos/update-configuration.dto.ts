import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ConfigurationType } from '@/dynamic-config/enums/configuration-type.enum';

export class UpdateConfigurationDTO {
  @IsOptional()
  value?: any;

  @IsEnum(ConfigurationType)
  @IsOptional()
  type?: ConfigurationType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}
