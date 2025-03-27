import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'
import { Permit2SingleTypedDataDTO } from './permit2-single-typed-data.dto'
import { Type } from 'class-transformer'

export class SinglePermitDataDTO {
  // permitType: 'Single'

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2SingleTypedDataDTO)
  typedData: Permit2SingleTypedDataDTO
}
