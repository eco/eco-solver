import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import * as ld from '@launchdarkly/node-server-sdk'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'
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
  private flagsClient!: ld.LDClient
  private context!: ld.LDContext
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
        (Object.keys(FlagVariationKeys) as FlagType[]).map(async (flag) => {
          this.flagValues[flag] = await this.flagsClient.variation(
            FlagVariationKeys[flag],
            this.context,
            this.flagValues[flag],
          )
        }),
      )
      lock.initialized = true
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `FlagService ready`,
          properties: {
            flags: this.flagValues,
          },
        }),
      )
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
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `FlagService update: unsupported flag`,
            properties: {
              flagName: param.key,
            },
          }),
        )
        return
      }
      const flag = param.key as FlagType
      this.flagValues[flag] = await this.flagsClient.variation(
        flag,
        this.context,
        this.flagValues[flag],
      )
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `FlagService update`,
          properties: {
            flagName: flag,
            flag: this.flagValues[flag],
          },
        }),
      )
    })
  }
}
