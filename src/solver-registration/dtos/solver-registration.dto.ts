import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString, IsIn, IsNotEmpty } from 'class-validator'
import { CrossChainRoutesDTO } from '@/solver-registration/dtos/cross-chain-routes.dto'
import {
  IntentExecutionType,
  IntentExecutionTypeKeys,
} from '@/quote/enums/intent-execution-type.enum'

export class SolverRegistrationDTO {
  @ApiProperty({ isArray: true, enum: IntentExecutionType })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionTypeKeys, { each: true })
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
