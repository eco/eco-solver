import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiZodResponse } from '@/common/decorators/zod-schema.decorator';

import { BigIntSerializerInterceptor } from '../../quotes/interceptors/bigint-serializer.interceptor';
import { ChainsResponse, ChainsResponseSchema } from '../schemas/chains-response.schema';
import { BlockchainInfoService } from '../services/blockchain-info.service';

@ApiTags('blockchain')
@Controller('api/v1/blockchain')
@UseInterceptors(BigIntSerializerInterceptor)
export class BlockchainController {
  constructor(private readonly blockchainInfoService: BlockchainInfoService) {}

  @Get('chains')
  @ApiOperation({
    summary: 'Get all supported blockchain networks and wallets',
    description:
      'Returns a list of all configured blockchain networks (EVM, SVM, TVM) along with their wallet addresses.',
  })
  @ApiZodResponse(
    200,
    ChainsResponseSchema,
    'List of all supported chains with their wallet configurations',
  )
  async getChains(): Promise<ChainsResponse> {
    return this.blockchainInfoService.getAllChains();
  }
}
