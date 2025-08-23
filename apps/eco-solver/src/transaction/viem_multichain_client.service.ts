import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  Chain,
  Client,
  ClientConfig,
  createClient,
  extractChain,
  Hex,
  zeroAddress,
  Account,
} from 'viem'
import { EcoError } from '../common/errors/eco-error'
import { getTransport } from '../common/chains/transport'
import { ChainsSupported } from '../common/chains/supported'
import { EcoConfigService } from '@libs/solver-config'

@Injectable()
export class ViemMultichainClientService<T extends any, V extends ClientConfig>
  implements OnModuleInit
{
  readonly instances: Map<number, T> = new Map()
  protected supportedAlchemyChainIds: number[] = []
  protected pollingInterval: number

  constructor(readonly ecoConfigService: EcoConfigService) {}

  onModuleInit() {
    this.setChainConfigs()
  }

  async getClient(id: number): Promise<T> {
    if (!this.isSupportedNetwork(id)) {
      throw EcoError.AlchemyUnsupportedNetworkIDError(id)
    }
    return this.loadInstance(id)
  }

  /**
   * Use overrides if they exist -- otherwise use the default settings.
   * @param chainID
   * @returns
   */
  public async getChainConfig(chainID: number): Promise<V> {
    const chain = extractChain({
      chains: ChainsSupported,
      id: chainID,
    })

    if (chain) {
      return this.buildChainConfig(chain)
    } else {
      throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
    }
  }

  protected async createInstanceClient(configs: V): Promise<T> {
    return createClient(configs as any) as T
  }

  protected async buildChainConfig(chain: Chain): Promise<V> {
    //only pass api key if chain is supported by alchemy, otherwise it'll be incorrectly added to other rpcs
    const { rpcUrls, config } = this.ecoConfigService.getRpcUrls(chain.id)

    const rpcTransport = getTransport(rpcUrls, config)
    return {
      transport: rpcTransport,
      chain: chain,
      pollingInterval: this.pollingInterval,
    } as V
  }

  /**
   * Returns the address of the wallet for the first solver in the config.
   * @returns
   */
  protected async getAddress(): Promise<Hex> {
    const solvers = this.ecoConfigService.getSolvers()
    if (!solvers || Object.values(solvers).length == 0) {
      return zeroAddress
    }

    const wallet = await this.getClient(Object.values(solvers)[0].chainID)
    return (wallet as any).account?.address || zeroAddress
  }

  private setChainConfigs() {
    this.pollingInterval = this.ecoConfigService.getEth().pollingInterval
  }

  private async loadInstance(chainID: number): Promise<T> {
    if (!this.instances.has(chainID)) {
      const client = await this.createInstanceClient(await this.getChainConfig(chainID))
      this.instances.set(chainID, client)
    }
    return this.instances.get(chainID)!
  }

  private isSupportedNetwork(chainID: number): boolean {
    return (
      this.supportedAlchemyChainIds.includes(chainID) ||
      ChainsSupported.some((chain) => chain.id === chainID)
    )
  }
}
