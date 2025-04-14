import { ApiProperty } from '@nestjs/swagger'
import { CrossChainRoutesDTO } from '@/solver-registration/dtos/cross-chain-routes.dto'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IsArray, IsString, IsIn, IsNotEmpty } from 'class-validator'

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

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesUrl: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiveSignedIntentUrl: string
}
