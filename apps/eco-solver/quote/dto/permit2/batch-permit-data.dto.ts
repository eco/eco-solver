import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, ValidateNested } from 'class-validator'
import { Permit2BatchTypedDataDTO } from '@/quote/dto/permit2/permit2-batch-typed-data.dto'
import { Type } from 'class-transformer'

export class BatchPermitDataDTO {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2BatchTypedDataDTO)
  typedData!: Permit2BatchTypedDataDTO
}
