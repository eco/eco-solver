import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'
import { Permit2BatchTypedDataDTO } from './permit2-batch-typed-data.dto'
import { Type } from 'class-transformer'

export class BatchPermitDataDTO {
  // permitType: 'Batch'

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2BatchTypedDataDTO)
  typedData: Permit2BatchTypedDataDTO
}
