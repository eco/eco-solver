import { ConfigurationType } from '@/dynamic-config/enums/configuration-type.enum'
import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional } from 'class-validator'

export class CreateConfigurationDTO {
  @IsString()
  @IsNotEmpty()
  key: string

  @IsNotEmpty()
  value: any

  @IsEnum(ConfigurationType)
  type: ConfigurationType

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false

  @IsString()
  @IsOptional()
  description?: string
}
