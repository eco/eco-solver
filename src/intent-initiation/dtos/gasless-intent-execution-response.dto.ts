import { ApiProperty } from '@nestjs/swagger'
import { GaslessIntentExecutionResponseEntryDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response-entry.dto'
import { IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class GaslessIntentExecutionResponseDTO {
  @ApiProperty({
    description: 'Array of successfully executed intents with transaction details',
    type: [GaslessIntentExecutionResponseEntryDTO],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GaslessIntentExecutionResponseEntryDTO)
  successes: GaslessIntentExecutionResponseEntryDTO[]

  @ApiProperty({
    description: 'Array of failed intent executions with error information',
    type: [GaslessIntentExecutionResponseEntryDTO],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GaslessIntentExecutionResponseEntryDTO)
  failures: GaslessIntentExecutionResponseEntryDTO[]
}
