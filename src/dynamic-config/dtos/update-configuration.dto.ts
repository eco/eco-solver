import { IsEnum, IsBoolean, IsOptional, IsString } from 'class-validator'
import { ConfigurationType } from '@/dynamic-config/dtos/create-configuration.dto'

export class UpdateConfigurationDTO {
  @IsOptional()
  value?: any

  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
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
