import { ApiPropertyOptional } from '@nestjs/swagger'
import { BatchPermitDataDTO } from './batch-permit-data.dto'
import { IsOptional, ValidateNested } from 'class-validator'
import { SinglePermitDataDTO } from './single-permit-data.dto'
import { Type } from 'class-transformer'

export class Permit2DataDTO {
  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => SinglePermitDataDTO)
  singlePermitData?: SinglePermitDataDTO

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => BatchPermitDataDTO)
  batchPermitData?: BatchPermitDataDTO
}
