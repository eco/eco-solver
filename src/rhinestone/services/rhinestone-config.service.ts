import { Injectable, OnModuleInit } from '@nestjs/common'
import { RhinestoneConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'

/**
 * Service for managing Rhinestone configuration.
 * Provides access to websocket, API, order, and contract configurations.
 */
@Injectable()
export class RhinestoneConfigService implements OnModuleInit {
  private config: RhinestoneConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    // Initialize config in constructor to ensure it's available when other services need it
    this.config = this.ecoConfigService.getRhinestone()
  }

  /**
   * Module initialization hook (config already loaded in constructor)
   */
  async onModuleInit() {
    // Config is already initialized in constructor
  }

  /**
   * Get websocket configuration
   * @returns Websocket configuration including URL and reconnect settings
   */
  getWebsocket() {
    return this.config.websocket
  }

  /**
   * Get API configuration for Rhinestone orchestrator
   * @returns API configuration including orchestrator URL and API key
   */
  getAPI() {
    return this.config.api
  }

  /**
   * Get order configuration
   * @returns Order configuration including settlement layer and order type
   */
  getOrder() {
    return this.config.order
  }

  /**
   * Get contract addresses for a specific chain
   * @param chainID The chain ID to get contracts for
   * @returns Contract addresses including router, eco adapter, and eco arbiter
   * @throws {EcoError} If chain configuration is not defined
   */
  getContracts(chainID: number) {
    const contracts = this.config.contracts[chainID.toString()]
    if (!contracts) throw EcoError.RhinestoneChainNotDefined(chainID)
    return contracts
  }
}
