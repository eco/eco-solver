import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator'
import { PermitDataDTO } from '@/quote/dto/permit-data.dto'
import { Type } from 'class-transformer'

export class GaslessIntentDataDTO {
  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDataDTO)
  permitData?: PermitDataDTO

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  allowPartial?: boolean = false
}
