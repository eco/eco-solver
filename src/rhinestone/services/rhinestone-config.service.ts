import { Injectable, OnModuleInit } from '@nestjs/common'
import { RhinestoneConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'

@Injectable()
export class RhinestoneConfigService implements OnModuleInit {
  private config: RhinestoneConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  async onModuleInit() {
    this.config = this.ecoConfigService.getRhinestone()
  }

  getWebsocket() {
    return this.config.websocket
  }

  getAPI() {
    return this.config.api
  }

  getOrder() {
    return this.config.order
  }

  getContracts(chainID: number) {
    const contracts = this.config.contracts[chainID]
    if (!contracts) throw EcoError.RhinestoneChainNotDefined(chainID)
    return contracts
  }
}
