import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, ValidateNested } from 'class-validator'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { Type } from 'class-transformer'

export class PermitDataDTO {
  @IsOptional()
  @IsArray()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDTO)
  permit?: PermitDTO[]

  @IsOptional()
  @IsArray()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => Permit2DTO)
  permit2?: Permit2DTO[]

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => Permit3DTO)
  permit3?: Permit3DTO
}
