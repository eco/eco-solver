import { ApiProperty } from '@nestjs/swagger'
import { GaslessIntentExecutionResponseEntryDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response-entry.dto'
import { IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class GaslessIntentExecutionResponseDTO {
  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GaslessIntentExecutionResponseEntryDTO)
  successes: GaslessIntentExecutionResponseEntryDTO[]

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GaslessIntentExecutionResponseEntryDTO)
  failures: GaslessIntentExecutionResponseEntryDTO[]
}
