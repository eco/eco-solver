import { Injectable, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Address as SvmAddress, createSolanaRpc, Rpc, SolanaRpcApi, RpcSubscriptions, createSolanaRpcSubscriptions, SolanaRpcSubscriptionsApi } from "@solana/kit";
import { Connection, PublicKey } from '@solana/web3.js';
import { EcoError } from '../common/errors/eco-error'
import { Address, VmType } from '@eco-foundation/routes-ts'

export interface SvmChainConfig {
  rpc: Rpc<SolanaRpcApi>
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>
  connection: Connection
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

  async getRpcSubscriptions(domainId: number): Promise<RpcSubscriptions<SolanaRpcSubscriptionsApi>> {
    if (!this.isSupportedNetwork(domainId)) {
      throw EcoError.AlchemyUnsupportedNetworkIDError(domainId)
    }
    return this.chainConfigs.get(domainId)!.rpcSubscriptions
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

     // check if we have Solana config
     
       const svmChainConfig: SvmChainConfig = {
         rpc: createSolanaRpc('https://solana.drpc.org/'),
         rpcSubscriptions: createSolanaRpcSubscriptions('wss://solana.drpc.org'),
         connection: new Connection('https://solana.drpc.org/', 'confirmed'),
         domainId: 1399811150
       }
      
      this.chainConfigs.set(svmChainConfig.domainId, svmChainConfig)
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