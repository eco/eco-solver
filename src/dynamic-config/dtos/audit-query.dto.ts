import { AuditOperation } from '@/dynamic-config/dtos/audit-response.dto'
import { IsOptional, IsNumber, IsString, IsEnum, Min, Max, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'

export class AuditQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsEnum(['CREATE', 'UPDATE', 'DELETE'])
  operation?: AuditOperation

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp'

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}
