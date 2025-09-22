import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CrossChainRoutesDTO } from '@/solver-registration/dtos/cross-chain-routes.dto'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IsArray, IsString, IsIn, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator'

export class SolverRegistrationDTO {
  @ApiProperty({ isArray: true, enum: IntentExecutionType.enumKeys })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
  @IsNotEmpty()
  intentExecutionTypes: string[]

  @ApiProperty()
  @IsNotEmpty()
  crossChainRoutes: CrossChainRoutesDTO

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  supportsNativeTransfers?: boolean

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesUrl: string

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  reverseQuotesUrl?: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesV2Url: string

  @IsOptional()
  @IsString()
  @ApiProperty()
  reverseQuotesV2Url?: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiveSignedIntentUrl: string

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  receiveSignedIntentV2Url?: string

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  gaslessIntentTransactionDataUrl?: string
}
