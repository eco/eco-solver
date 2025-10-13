import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional } from 'class-validator'

export type ConfigurationType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export class CreateConfigurationDTO {
  @IsString()
  @IsNotEmpty()
  key: string

  @IsNotEmpty()
  value: any

  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
  type: ConfigurationType

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean = false

  @IsString()
  @IsOptional()
  description?: string
}
