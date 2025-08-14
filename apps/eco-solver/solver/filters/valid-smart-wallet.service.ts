import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Hex } from 'viem'
import { EntryPointAbi_v6 } from '../../contracts/EntryPoint.V6.contract'
import { EcoLogMessage } from '../../common/logging/eco-log-message'

@Injectable()
export class ValidSmartWalletService implements OnModuleInit {
  private logger = new Logger(ValidSmartWalletService.name)

  private entryPointAddress!: Hex
  private factoryAddress!: Hex
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
   * @param smartWalletAddress the address of the smart wallet to validate
   * @param chainID the chain id of the transaction the event is from
   */
  async validateSmartWallet(smartWalletAddress: Hex, chainID: bigint): Promise<boolean> {
    const client = await this.publicClient.getClient(Number(chainID))
    try {
      const deployedEvents = await client.getContractEvents({
        address: this.entryPointAddress,
        abi: EntryPointAbi_v6,
        eventName: 'AccountDeployed',
        args: { sender: smartWalletAddress },
        fromBlock: 0n,
        toBlock: 'latest',
      })
      //should be only one event, but comes as an array
      return (
        deployedEvents && deployedEvents.some((event) => event.args.factory === this.factoryAddress)
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `RPC: getContractEvents error`,
          properties: {
            error,
          },
        }),
      )
      return false
    }
  }
}
