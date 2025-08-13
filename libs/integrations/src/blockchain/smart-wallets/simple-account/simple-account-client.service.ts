import { Injectable, Logger } from '@nestjs/common'
import { Chain } from 'viem'
import { SimpleAccountClient } from './simple-account.client'
import { SimpleAccountClientConfig } from './simple-account.config'
import { createSimpleAccountClient } from './create.simple.account'
import { ViemMultichainClientService } from '../../viem_multichain_client.service'
import { EcoConfigService, EcoError } from '@libs/shared'
import { SignerService } from '@libs/security'

@Injectable()
export class SimpleAccountClientService extends ViemMultichainClientService<
  SimpleAccountClient,
  SimpleAccountClientConfig
> {
  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerService,
  ) {
    super(ecoConfigService)
  }

  protected override async createInstanceClient(
    configs: SimpleAccountClientConfig,
  ): Promise<SimpleAccountClient> {
    return createSimpleAccountClient(configs)
  }

  protected override async buildChainConfig(chain: Chain): Promise<SimpleAccountClientConfig> {
    const base = await super.buildChainConfig(chain)
    const simpleAccountConfig = this.ecoConfigService.getEth().simpleAccount

    if (!simpleAccountConfig) {
      throw EcoError.InvalidSimpleAccountConfig()
    }

    return {
      ...base,
      simpleAccountAddress: simpleAccountConfig.walletAddr,
      account: this.signerService.getAccount(),
    }
  }
}
