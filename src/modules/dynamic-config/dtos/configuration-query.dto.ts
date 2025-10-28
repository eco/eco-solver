import { ConfigurationType } from '@/modules/dynamic-config/enums/configuration-type.enum';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { SortOrder } from '@/modules/dynamic-config/enums/sort-order.enum';
import { Transform, Type } from 'class-transformer';

export class ConfigurationQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ConfigurationType)
  type?: ConfigurationType;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const v = String(value).toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  })
  isRequired?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const v = String(value).toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  })
  isSecret?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: string = 'key';

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsString()
  lastModifiedBy?: string;

  @IsOptional()
  @IsString()
  createdAfter?: string;

  @IsOptional()
  @IsString()
  createdBefore?: string;

  @IsOptional()
  @IsString()
  updatedAfter?: string;

  @IsOptional()
  @IsString()
  updatedBefore?: string;
}
