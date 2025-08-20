import { Injectable } from '@nestjs/common'
import {
  Chain,
  createPublicClient,
  createWalletClient,
  extractChain,
  ParseAccount,
  PrivateKeyAccount,
  Transport,
  WalletClient,
  WalletClientConfig,
} from 'viem'
import { SignerService } from '@eco-solver/sign/signer.service'
import { EcoConfigService } from '@libs/eco-solver-config'
import { ViemMultichainClientService } from '../viem_multichain_client.service'
import { ChainsSupported } from '@eco-solver/common/chains/supported'

export abstract class WalletClientService<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain,
  accountOrAddress extends PrivateKeyAccount = PrivateKeyAccount,
  instance extends WalletClient<
    transport,
    chain,
    ParseAccount<accountOrAddress>,
    undefined
  > = WalletClient<transport, chain, ParseAccount<accountOrAddress>, undefined>,
  config extends WalletClientConfig<
    transport,
    chain,
    accountOrAddress,
    undefined
  > = WalletClientConfig<transport, chain, accountOrAddress, undefined>,
> extends ViemMultichainClientService<instance, config> {
  async getPublicClient(chainID: number) {
    const chain = extractChain({
      chains: ChainsSupported,
      id: chainID,
    })

    const config = await super.buildChainConfig(chain)

    return createPublicClient(config)
  }

  abstract getAccount(): Promise<accountOrAddress>

  protected override async createInstanceClient(configs: config): Promise<instance> {
    return createWalletClient(configs) as instance
  }

  protected override async buildChainConfig(chain: Chain): Promise<config> {
    const base = await super.buildChainConfig(chain)
    return {
      ...base,
      account: await this.getAccount(),
    }
  }
}

@Injectable()
export class WalletClientDefaultSignerService extends WalletClientService {
  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerService,
  ) {
    super(ecoConfigService)
  }

  getAccount(): Promise<PrivateKeyAccount> {
    return Promise.resolve(this.signerService.getAccount())
  }
}
