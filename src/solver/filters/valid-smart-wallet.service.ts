import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Hex } from 'viem'
import { EntryPointAbi_v6 } from '../../contracts/EntryPoint.V6.contract'
import { EcoLogMessage } from '../../common/logging/eco-log-message'

@Injectable()
export class ValidSmartWalletService implements OnModuleInit {
  private logger = new Logger(ValidSmartWalletService.name)

  private entryPointAddress: Hex
  private factoryAddress: Hex

  constructor(
    private readonly publicClient: MultichainPublicClientService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  onModuleInit() {
    const contracts = this.ecoConfigService.getEth().simpleAccount.contracts
    this.entryPointAddress = contracts.entryPoint.contractAddress
    this.factoryAddress = contracts.simpleAccountFactory.contractAddress
  }

  /**
   * Validates that the smart wallet account that posts and creates an IntentCreated event on chain
   * for the IntentSource contract, is from the correct smart wallet factory.
   *
   * @param smartWalletAddress - The address of the smart wallet to validate.
   * @param chainID - The chain ID of the transaction the event is from.
   * @returns A promise that resolves to a boolean indicating whether the smart wallet is valid.
   */
  async validateSmartWallet(smartWalletAddress: Hex, chainID: bigint): Promise<boolean> {
    try {
      const accountDeployedEvent = await this.getAccountDeployedEventWithRetries(
        smartWalletAddress,
        chainID,
      )
      return accountDeployedEvent?.args.factory === this.factoryAddress
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `RPC: getContractEvents error`,
          properties: { error },
        }),
      )
    }
    return false
  }

  /**
   * Attempts to retrieve the AccountDeployed event with retries.
   *
   * @param smartWalletAddress - The address of the smart wallet.
   * @param chainID - The chain ID of the transaction.
   * @param attempts - The number of retry attempts.
   * @returns A promise that resolves to the event or undefined if not found.
   */
  private async getAccountDeployedEventWithRetries(
    smartWalletAddress: Hex,
    chainID: bigint,
    attempts = 3,
  ) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const event = await this.getAccountDeployedEvent(smartWalletAddress, chainID)
      if (event) return event

      // Wait an exponential time before retrying
      await this.wait(1_000 * Math.pow(2, attempt))
    }
    return undefined
  }

  /**
   * Retrieves the AccountDeployed event for the given smart wallet address and chain ID.
   *
   * @param smartWalletAddress - The address of the smart wallet.
   * @param chainID - The chain ID of the transaction.
   * @returns A promise that resolves to the event or undefined if not found.
   */
  private async getAccountDeployedEvent(smartWalletAddress: Hex, chainID: bigint) {
    const client = await this.publicClient.getClient(Number(chainID))
    const events = await client.getContractEvents({
      address: this.entryPointAddress,
      abi: EntryPointAbi_v6,
      eventName: 'AccountDeployed',
      args: { sender: smartWalletAddress },
      fromBlock: 0n,
      toBlock: 'latest',
    })

    // Should be only one event, but comes as an array
    return events[0]
  }

  /**
   * Waits for the specified number of milliseconds.
   *
   * @param ms - The number of milliseconds to wait.
   * @returns A promise that resolves after the specified time.
   */
  private wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
