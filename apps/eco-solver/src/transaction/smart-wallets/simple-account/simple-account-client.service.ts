import { Injectable } from '@nestjs/common'
import { EcoConfigService } from '@libs/config-core'
import { ViemMultichainClientService } from '../../viem_multichain_client.service'
import { SimpleAccountClient, SimpleAccountClientConfig } from '.'
import { EcoError } from '../../../common/errors/eco-error'
import { createSimpleAccountClient } from './create.simple.account'
import { SignerService } from '../../../sign/signer.service'
import { Chain } from 'viem'

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
