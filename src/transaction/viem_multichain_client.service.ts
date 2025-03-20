import { Injectable, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Chain, Client, ClientConfig, createClient, extractChain, Hex, zeroAddress } from 'viem'
import { EcoError } from '../common/errors/eco-error'
import { ChainsSupported } from '../common/chains/supported'
import { getTransport } from '../common/chains/transport'

@Injectable()
export class ViemMultichainClientService<T extends Client, V extends ClientConfig>
  implements OnModuleInit
{
  readonly instances: Map<number, T> = new Map()

  protected supportedAlchemyChainIds: number[] = []
  protected apiKey: string
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

  private setChainConfigs() {
    const alchemyConfigs = this.ecoConfigService.getAlchemy()
    this.supportedAlchemyChainIds = alchemyConfigs.networks.map((n) => n.id)
    this.apiKey = alchemyConfigs.apiKey
    this.pollingInterval = this.ecoConfigService.getEth().pollingInterval
  }

  private async loadInstance(chainID: number): Promise<T> {
    if (!this.instances.has(chainID)) {
      const client = await this.createInstanceClient(await this.getChainConfig(chainID))
      this.instances.set(chainID, client)
    }
    return this.instances.get(chainID)!
  }

  protected async createInstanceClient(configs: V): Promise<T> {
    //@ts-expect-error client mismatch on property definition
    return createClient(configs)
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
      throw EcoError.UnsupportedChainError(chain[0])
    }
  }

  protected async buildChainConfig(chain: Chain): Promise<V> {
    const { url: rpcUrl, isWebsocket } = this.ecoConfigService.getRpcUrl(chain)
    const rpcTransport = getTransport(rpcUrl, isWebsocket)
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
    return wallet.account?.address || zeroAddress
  }

  private isSupportedNetwork(chainID: number): boolean {
    return (
      this.supportedAlchemyChainIds.includes(chainID) ||
      ChainsSupported.some((chain) => chain.id === chainID)
    )
  }
}
