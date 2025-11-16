import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { ConfigurationType } from '@/modules/dynamic-config/enums/configuration-type.enum';

export class CreateConfigurationDTO {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsNotEmpty()
  value: any;

  @IsEnum(ConfigurationType)
  type: ConfigurationType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

  @IsString()
  @IsOptional()
  description?: string;
}
