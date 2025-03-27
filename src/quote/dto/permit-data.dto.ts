import { ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator'
import { Permit2DTO } from './permit2/permit2.dto'
import { PermitDTO } from './permit/permit.dto'
import { Type } from 'class-transformer'

export class PermitDataDTO {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDTO)
  permit?: PermitDTO[]

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => Permit2DTO)
  permit2?: Permit2DTO
}
