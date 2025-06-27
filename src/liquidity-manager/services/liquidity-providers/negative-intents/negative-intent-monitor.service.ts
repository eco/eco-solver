import { Injectable, Logger } from '@nestjs/common'
import { ExtractAbiEvent } from 'abitype'
import { Hex, Log, PublicClient } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { IntentSourceAbi, IProverAbi } from '@eco-foundation/routes-ts'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

type IntentProvenEvent = ExtractAbiEvent<typeof IProverAbi, 'IntentProven'>
type IntentProvenLog = Log<bigint, number, boolean, IntentProvenEvent, true>

interface NegativeIntentContext {
  intentHash: Hex
  sourceChainId: number
  destinationChainId: number
  transactionHash?: Hex
  proven: boolean
  withdrawn: boolean
}

@Injectable()
export class NegativeIntentMonitorService {
  private logger = new Logger(NegativeIntentMonitorService.name)
  private monitoredIntents: Map<Hex, NegativeIntentContext> = new Map()
  private unwatchFunctions: Map<string, () => void> = new Map()

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly publicClient: MultichainPublicClientService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  /**
   * Start monitoring a negative intent for:
   * 1. Transaction execution on-chain
   * 2. IntentProven event emission
   * 3. Withdrawal execution
   */
  async monitorNegativeIntent(
    intentHash: Hex,
    sourceChainId: number,
    destinationChainId: number,
    balanceTransactionHash?: Hex,
  ): Promise<void> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Starting negative intent monitoring',
        properties: {
          intentHash,
          sourceChainId,
          destinationChainId,
          balanceTransactionHash,
        },
      }),
    )

    const context: NegativeIntentContext = {
      intentHash,
      sourceChainId,
      destinationChainId,
      transactionHash: balanceTransactionHash,
      proven: false,
      withdrawn: false,
    }

    this.monitoredIntents.set(intentHash, context)

    // Step 1: Wait for the balance transaction if provided
    if (balanceTransactionHash) {
      await this.waitForBalanceTransaction(context)
    }

    // Step 2: Watch for IntentProven event
    await this.watchForIntentProven(context)
  }

  /**
   * Clean up all watchers on module destroy
   */
  onModuleDestroy() {
    this.unwatchFunctions.forEach((unwatch) => unwatch())
    this.unwatchFunctions.clear()
    this.monitoredIntents.clear()
  }

  /**
   * Wait for the negative intent balance transaction to be executed on-chain
   */
  private async waitForBalanceTransaction(context: NegativeIntentContext): Promise<void> {
    if (!context.transactionHash) return

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Waiting for balance transaction confirmation',
        properties: {
          intentHash: context.intentHash,
          transactionHash: context.transactionHash,
        },
      }),
    )

    try {
      const client = await this.publicClient.getClient(context.destinationChainId)
      const receipt = await client.waitForTransactionReceipt({
        hash: context.transactionHash,
        confirmations: 2, // Wait for 2 confirmations for safety
      })

      if (receipt.status === 'success') {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'Balance transaction confirmed',
            properties: {
              intentHash: context.intentHash,
              transactionHash: context.transactionHash,
              blockNumber: receipt.blockNumber.toString(),
            },
          }),
        )
      } else {
        throw new Error('Balance transaction failed')
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to confirm balance transaction',
          properties: {
            intentHash: context.intentHash,
            transactionHash: context.transactionHash,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Watch for IntentProven event on the source chain
   */
  private async watchForIntentProven(context: NegativeIntentContext): Promise<void> {
    const intentSource = this.getIntentSource(context.sourceChainId)
    if (!intentSource) {
      throw new Error(`No intent source found for chain ${context.sourceChainId}`)
    }

    const client = await this.publicClient.getClient(context.sourceChainId)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Watching for IntentProven event',
        properties: {
          intentHash: context.intentHash,
          sourceChainId: context.sourceChainId,
          intentSourceAddress: intentSource.sourceAddress,
        },
      }),
    )

    // Set up event watcher for IntentProven
    const unwatch = client.watchContractEvent({
      address: intentSource.sourceAddress as Hex,
      abi: IProverAbi,
      eventName: 'IntentProven',
      strict: true,
      args: {
        _hash: context.intentHash,
      },
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleIntentProven(context, log as IntentProvenLog)
        }
      },
      onError: (error) => {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Error watching IntentProven event',
            properties: {
              intentHash: context.intentHash,
              error: error.message,
            },
          }),
        )
      },
    })

    // Store unwatch function for cleanup
    this.unwatchFunctions.set(`proven-${context.intentHash}`, unwatch)

    // Also check historical events in case it was already proven
    await this.checkHistoricalIntentProven(context, client, intentSource.sourceAddress as Hex)
  }

  /**
   * Check if IntentProven event was already emitted
   */
  private async checkHistoricalIntentProven(
    context: NegativeIntentContext,
    client: PublicClient,
    intentSourceAddress: Hex,
  ): Promise<void> {
    try {
      const currentBlock = await client.getBlockNumber()
      const fromBlock = currentBlock - 1000n // Check last 1000 blocks

      const events = await client.getContractEvents({
        address: intentSourceAddress,
        abi: IProverAbi,
        eventName: 'IntentProven',
        args: {
          _hash: context.intentHash,
        },
        fromBlock,
        toBlock: currentBlock,
      })

      if (events.length > 0) {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'Found historical IntentProven event',
            properties: {
              intentHash: context.intentHash,
              eventCount: events.length,
            },
          }),
        )
        await this.handleIntentProven(context, events[0] as IntentProvenLog)
      }
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Failed to check historical IntentProven events',
          properties: {
            intentHash: context.intentHash,
            error: error.message,
          },
        }),
      )
    }
  }

  /**
   * Handle IntentProven event
   */
  private async handleIntentProven(
    context: NegativeIntentContext,
    log: IntentProvenLog,
  ): Promise<void> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'IntentProven event detected',
        properties: {
          intentHash: context.intentHash,
          blockNumber: log.blockNumber?.toString(),
          transactionHash: log.transactionHash,
        },
      }),
    )

    context.proven = true

    // Clean up the watcher
    const unwatchKey = `proven-${context.intentHash}`
    const unwatch = this.unwatchFunctions.get(unwatchKey)
    if (unwatch) {
      unwatch()
      this.unwatchFunctions.delete(unwatchKey)
    }

    // Step 3: Execute withdrawal
    await this.executeWithdrawal(context)
  }

  /**
   * Execute withdrawal for the negative intent
   */
  private async executeWithdrawal(context: NegativeIntentContext): Promise<void> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Executing withdrawal for negative intent',
          properties: {
            intentHash: context.intentHash,
            sourceChainId: context.sourceChainId,
          },
        }),
      )

      const intentSource = this.getIntentSource(context.sourceChainId)
      if (!intentSource) {
        throw new Error(`No intent source found for chain ${context.sourceChainId}`)
      }

      // Get the kernel wallet client for the source chain
      const kernelClient = await this.kernelAccountClientService.getClient(context.sourceChainId)

      // Execute withdrawal on the IntentSource contract
      const txHash = await kernelClient.writeContract({
        address: intentSource.sourceAddress as Hex,
        abi: IntentSourceAbi,
        functionName: 'withdrawRewards',
        args: [intent],
        chain: kernelClient.chain,
        account: kernelClient.kernelAccount,
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Withdrawal transaction submitted',
          properties: {
            intentHash: context.intentHash,
            transactionHash: txHash,
          },
        }),
      )

      // Wait for confirmation
      const receipt = await kernelClient.waitForTransactionReceipt({ hash: txHash })

      if (receipt.status === 'success') {
        context.withdrawn = true
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'Negative intent withdrawal completed successfully',
            properties: {
              intentHash: context.intentHash,
              transactionHash: txHash,
              blockNumber: receipt.blockNumber.toString(),
            },
          }),
        )

        // Clean up monitored intent
        this.monitoredIntents.delete(context.intentHash)
      } else {
        throw new Error('Withdrawal transaction failed')
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to execute withdrawal',
          properties: {
            intentHash: context.intentHash,
            error: error.message,
          },
        }),
      )
      // Keep monitoring - might need manual intervention
    }
  }

  private getIntentSource(chainId: number) {
    const intentSources = this.ecoConfigService.getIntentSources()
    return intentSources.find((source) => source.chainID === chainId)
  }
}
