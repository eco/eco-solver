import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IntentExecutionType } from '@/modules/api/quotes/enums/intent-execution-type.enum';

export class SolverRegistrationResponseDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  solverID: string;

  @ApiProperty({ isArray: true, enum: IntentExecutionType.enumKeys })
  @IsArray()
  @IsString({ each: true })
  @IsIn(IntentExecutionType.enumKeys, { each: true })
  @IsNotEmpty()
  intentExecutionTypes: string[];

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  supportsNativeTransfers?: boolean;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  quotesUrl: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  reverseQuotesUrl: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  quotesV2Url?: string;

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
