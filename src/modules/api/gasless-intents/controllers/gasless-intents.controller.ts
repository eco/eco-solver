import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiZodBody, ApiZodResponse } from '@/common/decorators/zod-schema.decorator';
import { getEcoServiceException } from '@/errors/eco-service-exception';
import {
  GaslessIntentExecutionResponseDTO,
  GaslessIntentExecutionResponseDTOSchema,
} from '@/modules/api/gasless-intents/dtos/gasless-intent-execution-response-dto.schema';
import {
  GaslessIntentRequestDTO,
  GaslessIntentRequestDTOSchema,
} from '@/modules/api/gasless-intents/dtos/gasless-intent-request-dto.schema';
import { API_V2_ROOT } from '@/modules/api/paths';
import { ValidateRequest } from '@/modules/api/quotes/decorators';

import { INTENT_INITIATION_ROUTE } from '../constants/endpoint';
import { GaslessIntentsService } from '../services/gasless-intents.service';

@ApiTags('gasless-intents')
@Controller(API_V2_ROOT + INTENT_INITIATION_ROUTE)
@UseGuards(ThrottlerGuard)
export class GaslessIntentsController {
  constructor(private readonly gaslessIntentsService: GaslessIntentsService) {}

  @Post('/initiateGaslessIntent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate a gasless intent',
    description:
      'Initiates a gasless intent by generating and executing permit and fundFor transactions across multiple chains. ' +
      'The solver handles gas costs, making the transaction gasless for the user.',
  })
  @ApiZodBody(GaslessIntentRequestDTOSchema, 'Gasless intent initiation request')
  @ApiZodResponse(
    HttpStatus.OK,
    GaslessIntentExecutionResponseDTOSchema,
    'Gasless intent initiated successfully',
  )
  @ValidateRequest(GaslessIntentRequestDTOSchema)
  async initiateGaslessIntent(
    @Body() request: GaslessIntentRequestDTO,
  ): Promise<GaslessIntentExecutionResponseDTO> {
    const { response: gaslessIntentExecutionResponse, error } =
      await this.gaslessIntentsService.initiateGaslessIntent(request);

    if (!error) {
      return gaslessIntentExecutionResponse!;
    }

    const errorStatus = (error as any).statusCode;

    if (errorStatus) {
      throw getEcoServiceException({ error });
    }

    // Throw a generic InternalServerErrorException if error has no statusCode
    throw getEcoServiceException({
      httpExceptionClass: InternalServerErrorException,
      error: { message: JSON.stringify(error) },
    });
  }
}
