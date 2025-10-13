import { ConfigurationType } from '@/dynamic-config/dtos/create-configuration.dto'
import { IsOptional, IsNumber, IsString, IsEnum, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

export class ConfigurationQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
  type?: ConfigurationType

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isRequired?: boolean

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isSecret?: boolean

  @IsOptional()
  @IsString()
  sortBy?: string = 'key'

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc'

  @IsOptional()
  @IsString()
  lastModifiedBy?: string

  @IsOptional()
  @IsString()
  createdAfter?: string

  @IsOptional()
  @IsString()
  createdBefore?: string

  @IsOptional()
  @IsString()
  updatedAfter?: string

  @IsOptional()
  @IsString()
  updatedBefore?: string
}
