import { Injectable, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Address as SvmAddress, createSolanaRpc, Rpc, SolanaRpcApi } from "@solana/kit";
import { EcoError } from '../common/errors/eco-error'

export interface SvmChainConfig {
  rpc: Rpc<SolanaRpcApi>
  websocketUrl?: string
  domainId: number
}

@Injectable()
export class SvmMultichainClientService implements OnModuleInit {
  readonly rpcs: Map<number, Rpc<SolanaRpcApi>> = new Map()
  
  protected supportedChainIds: number[] = []
  protected chainConfigs: Map<number, SvmChainConfig> = new Map()
  
  constructor(readonly ecoConfigService: EcoConfigService) {}

  onModuleInit() {
    this.setSvmChainConfigs()
  }

  async getRpc(domainId: number): Promise<Rpc<SolanaRpcApi>> {
    if (!this.isSupportedNetwork(domainId)) {
      throw EcoError.AlchemyUnsupportedNetworkIDError(domainId)
    }
    return this.chainConfigs.get(domainId)!.rpc
  }

  getChainConfig(domainId: number): SvmChainConfig | undefined {
    return this.chainConfigs.get(domainId)
  }

  private setSvmChainConfigs() {

     // check if we have Solana config
     
       const svmChainConfig: SvmChainConfig = {
         rpc: createSolanaRpc('https://solana.drpc.org/'),
         websocketUrl: 'wss://solana.drpc.org',
         domainId: 1399811150
       }
      
      this.chainConfigs.set(svmChainConfig.domainId, svmChainConfig)
      this.supportedChainIds = Array.from(this.chainConfigs.keys())
    
  }



  private isSupportedNetwork(domainId: number): boolean {
    return this.supportedChainIds.includes(domainId)
  }

  public getAddress(): SvmAddress {
    // TODO: hardcoded for now
    return 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh' as SvmAddress
  }
}