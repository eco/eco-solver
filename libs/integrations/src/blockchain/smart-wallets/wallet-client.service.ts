import { Injectable } from '@nestjs/common'
import {   Chain,
  createPublicClient,
  createWalletClient,
  extractChain,
  ParseAccount,
  PrivateKeyAccount,
  Transport,
  WalletClient,
  WalletClientConfig,
} from 'viem'
import { LocalAccount } from 'viem/accounts'

// Wallet client service interface  
interface IWalletClientService {
  getAccount(): Promise<LocalAccount>;
  signMessage(message: string): Promise<string>;
}
import { EcoConfigService } from '@libs/shared'
import { SignerService } from '@libs/security'

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
export class WalletClientDefaultSignerService extends WalletClientService implements IWalletClientService {
  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerService,
  ) {
    super(ecoConfigService)
  }

  async getAccount(): Promise<LocalAccount> {
    return this.signerService.getAccount() as LocalAccount
  }

  async signMessage(message: string): Promise<string> {
    const account = await this.getAccount()
    return account.signMessage({ message })
  }
}
