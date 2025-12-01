import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class GaslessIntentTransactionDataRequestDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Unique identifier for the intent group to query',
    example: 'intent-group:abc123',
  })
  intentGroupID: string
}
