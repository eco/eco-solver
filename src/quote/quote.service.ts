import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy, zipWith } from 'lodash'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getDestinationNetworkAddressKey } from '@/common/utils/strings'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { erc20Abi, Hex, MulticallParameters, MulticallReturnType } from 'viem'
import { ViemEventLog } from '@/common/events/viem'
import { decodeTransferLog, isSupportedTokenType } from '@/contracts'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(
    private readonly ecoConfig: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  async onApplicationBootstrap() {

  }

  async getQuote() {
    return
  }
}
