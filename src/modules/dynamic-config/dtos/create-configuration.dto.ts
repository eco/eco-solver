import { ConfigurationType } from '@/modules/dynamic-config/enums/configuration-type.enum';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
