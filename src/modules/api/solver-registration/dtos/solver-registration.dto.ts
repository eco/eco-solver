import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { IntentExecutionType } from '@/modules/api/quotes/enums/intent-execution-type.enum';
import { CrossChainRoutesDTO } from '@/modules/api/solver-registration/dtos/cross-chain-routes.dto';

export class SolverRegistrationDTO {
  @ApiProperty({ isArray: true, enum: IntentExecutionType.enumKeys })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
  @IsNotEmpty()
  intentExecutionTypes: string[];

  @ApiProperty()
  @IsNotEmpty()
  crossChainRoutes: CrossChainRoutesDTO;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  supportsNativeTransfers?: boolean;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesUrl: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  reverseQuotesUrl?: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesV2Url: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  reverseQuotesV2Url?: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiveSignedIntentUrl: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  receiveSignedIntentV2Url?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  gaslessIntentTransactionDataUrl?: string;
}
