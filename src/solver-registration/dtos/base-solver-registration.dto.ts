import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IsArray, IsString, IsIn, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator'

export class BaseSolverRegistrationDTO {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  solverID?: string

  @ApiProperty({ isArray: true, enum: IntentExecutionType.enumKeys })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
  @IsNotEmpty()
  intentExecutionTypes: string[]

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  supportsNativeTransfers?: boolean

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesUrl: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesV2Url: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiveSignedIntentUrl: string

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  gaslessIntentTransactionDataUrl?: string
}
