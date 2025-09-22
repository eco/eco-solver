import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class GaslessIntentTransactionDataRequestDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  intentGroupID: string
}
