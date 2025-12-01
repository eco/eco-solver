import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class GaslessIntentExecutionResponseEntryDTO {
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    description: 'Chain ID where the intent was executed',
    example: 1,
  })
  chainID: number

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Array of quote IDs included in this transaction',
    example: ['quote:966ee977-586b-4bca-abf1-e7def508a19c'],
  })
  quoteIDs: string[]

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Transaction hash of the executed intent',
    example: '0xabc123...',
  })
  transactionHash: Hex

  @ApiPropertyOptional({
    description: 'Error information if execution failed',
  })
  error?: any
}
