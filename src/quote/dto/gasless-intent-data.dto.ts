import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { PermitDataDTO } from '@/quote/dto/permit-data.dto'
import { IsOptional, ValidateNested } from 'class-validator'

export class GaslessIntentDataDTO {
  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDataDTO)
  permitData?: PermitDataDTO
}
