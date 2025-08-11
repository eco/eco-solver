import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsString, IsIn, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator'
import { IntentExecutionType } from '@libs/shared'
import { CrossChainRoutesDTO } from './cross-chain-routes.dto'

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

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiveSignedIntentUrl: string
}
