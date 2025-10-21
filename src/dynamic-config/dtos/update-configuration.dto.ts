import { ConfigurationType } from '@/dynamic-config/enums/configuration-type.enum'
import { IsEnum, IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateConfigurationDTO {
  @IsOptional()
  value?: any

  @IsEnum(ConfigurationType)
  @IsOptional()
  type?: ConfigurationType

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean

  @IsString()
  @IsOptional()
  description?: string
}
