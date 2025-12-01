import { ApiProperty } from '@nestjs/swagger'
import { BaseGaslessIntentRequestDTO } from '@/quote/dto/base-gasless-intent-request.dto'
import { GaslessIntentDataDTO } from '@/quote/dto/gasless-intent-data.dto'
import { GaslessIntentDataV2DTO } from '@/quote/dto/v2/gasless-intent-data-v2.dto'
import { IsNotEmpty, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class GaslessIntentRequestV2DTO extends BaseGaslessIntentRequestDTO {
  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty({
    description: 'Permit3 signature data for multi-chain token approvals',
    type: () => GaslessIntentDataV2DTO,
  })
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData: GaslessIntentDataV2DTO
}
