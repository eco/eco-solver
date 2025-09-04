import { Injectable, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'

import { Connection, PublicKey } from '@solana/web3.js'
import { EcoError } from '../common/errors/eco-error'
import { Address, VmType } from '@/eco-configs/eco-config.types'

export interface SvmChainConfig {
  connection: Connection
  domainId: number
}

@Injectable()
export class SvmMultichainClientService implements OnModuleInit {
  protected supportedChainIds: number[] = []
  protected chainConfigs: Map<number, SvmChainConfig> = new Map()

  constructor(readonly ecoConfigService: EcoConfigService) {}

  onModuleInit() {
    this.setSvmChainConfigs()
  }

  async getConnection(domainId: number): Promise<Connection> {
    if (!this.isSupportedNetwork(domainId)) {
      throw EcoError.AlchemyUnsupportedNetworkIDError(domainId)
    }
    return this.chainConfigs.get(domainId)!.connection
  }

  getChainConfig(domainId: number): SvmChainConfig | undefined {
    return this.chainConfigs.get(domainId)
  }

  private setSvmChainConfigs() {
    const rpcs = this.ecoConfigService.getRpcConfig()
    const customRpcConfig = rpcs.custom

    // Configure Solana mainnet (chain ID 1399811149)
    const solanaChainId = 1399811149
    const solanaConfig = customRpcConfig?.[solanaChainId.toString()]

    if (solanaConfig?.http?.[0] && solanaConfig?.webSocket?.[0]) {
      const httpUrl = solanaConfig.http[0] // Use first HTTP RPC URL
      const wsUrl = solanaConfig.webSocket[0] // Use first WebSocket RPC URL

      const svmChainConfig: SvmChainConfig = {
        connection: new Connection(httpUrl, 'confirmed'),
        domainId: solanaChainId,
      }

      this.chainConfigs.set(svmChainConfig.domainId, svmChainConfig)
    }

    this.supportedChainIds = Array.from(this.chainConfigs.keys())
  }

  private isSupportedNetwork(domainId: number): boolean {
    return this.supportedChainIds.includes(domainId)
  }

  public getAddress(): Address<VmType.SVM> {
    // TODO: hardcoded for now
    return new PublicKey('DTrmsGNtx3ki5PxMwv3maBsHLZ2oLCG7LxqdWFBgBtqh')
  }
}
