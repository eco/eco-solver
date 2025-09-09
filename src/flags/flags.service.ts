import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import * as ld from '@launchdarkly/node-server-sdk'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { waitForInitialization } from './utils'

export type LaunchDarklyFlags = {
  bendWalletOnly: boolean
}

export type FlagType = keyof LaunchDarklyFlags

export const FlagVariationKeys: Record<FlagType, string> = {
  bendWalletOnly: 'bendWalletOnly',
}

/**
 * Service class for interacting with the Launch Darkly feature flagging service
 */
@Injectable()
export class FlagService implements OnModuleInit {
  private logger = new Logger(FlagService.name)
  private flagsClient: ld.LDClient
  private context: ld.LDContext
  private flagValues: LaunchDarklyFlags = {
    bendWalletOnly: false,
  }
  constructor(
    private readonly kernelAccountService: KernelAccountClientService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    await this.initLaunchDarklyClient()
    this.registerFlagListeners()
  }

  public getFlagValue<T extends FlagType>(flag: T): LaunchDarklyFlags[T] {
    return this.flagValues[flag]
  }

  public static isSupportedFlag(flag: string): boolean {
    return Object.keys(FlagVariationKeys).includes(flag)
  }

  /**
   * Initializes the Launch Darkly client with the provided API key. Sets an
   * on ready listener to initialize the flags
   */
  private async initLaunchDarklyClient() {
    this.context = { kind: 'solver-pod', key: await this.kernelAccountService.getAddress() }
    this.flagsClient = ld.init(this.ecoConfigService.getLaunchDarkly().apiKey)
    const lock = { initialized: false }
    this.flagsClient.on('ready', async () => {
      await Promise.all(
        Object.values(FlagVariationKeys).map(async (flag) => {
          this.flagValues[flag] = await this.flagsClient.variation(
            flag,
            this.context,
            this.flagValues[flag],
          )
        }),
      )
      lock.initialized = true
      this.logger.log(`FlagService ready`, {
        service: 'flag-service',
        operation: 'init_launch_darkly',
        flags: this.flagValues,
        context_key: this.context.key,
      })
    })
    // Wait for the flags to be initialized
    await waitForInitialization(lock)
  }

  /**
   * Registers update listeners for when flags are updated. Also occures on first init
   */
  private registerFlagListeners() {
    this.flagsClient.on('update', async (param) => {
      if (!FlagService.isSupportedFlag(param.key)) {
        this.logger.log(`FlagService update: unsupported flag`, {
          service: 'flag-service',
          operation: 'register_flag_listeners',
          flag_name: param.key,
          supported_flags: Object.keys(FlagVariationKeys),
        })
        return
      }
      const flag = param.key
      this.flagValues[flag] = await this.flagsClient.variation(
        flag,
        this.context,
        this.flagValues[flag],
      )
      this.logger.log(`FlagService update`, {
        service: 'flag-service',
        operation: 'register_flag_listeners',
        flag_name: flag,
        flag_value: this.flagValues[flag],
      })
    })
  }
}
