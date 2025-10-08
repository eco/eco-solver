import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiZodBody, ApiZodResponse } from '@/common/decorators/zod-schema.decorator';
import { ValidateRequest } from '@/modules/api/quotes/decorators';

import { GASLESS_INTENTS_ENDPOINT } from '../constants/endpoint';
import {
  GaslessIntentRequest,
  GaslessIntentRequestSchema,
} from '../schemas/gasless-intent-request.schema';
import {
  GaslessIntentResponse,
  GaslessIntentResponseSchema,
} from '../schemas/gasless-intent-response.schema';
import { GaslessIntentsService } from '../services/gasless-intents.service';

@ApiTags('gasless-intents')
@Controller(GASLESS_INTENTS_ENDPOINT)
@UseGuards(ThrottlerGuard)
export class GaslessIntentsController {
  constructor(private readonly gaslessIntentsService: GaslessIntentsService) {}

  @Post('/initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate a gasless intent',
    description:
      'Initiates a gasless intent by generating and executing permit and fundFor transactions across multiple chains. ' +
      'The solver handles gas costs, making the transaction gasless for the user.',
  })
  @ApiZodBody(GaslessIntentRequestSchema, 'Gasless intent initiation request')
  @ApiZodResponse(
    HttpStatus.OK,
    GaslessIntentResponseSchema,
    'Gasless intent initiated successfully',
  )
  @ValidateRequest(GaslessIntentRequestSchema)
  async initiateGaslessIntent(
    @Body() request: GaslessIntentRequest,
  ): Promise<GaslessIntentResponse> {
    return this.gaslessIntentsService.initiateGaslessIntent(request);
  }
}
