import { Injectable, Logger } from '@nestjs/common'
import { ExtractAbiEvent } from 'abitype'
import { Hex, Log } from 'viem'
import { IProverAbi } from '@eco-foundation/routes-ts'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'

type IntentProvenEvent = ExtractAbiEvent<typeof IProverAbi, 'IntentProven'>
type IntentProvenLog = Log<bigint, number, boolean, IntentProvenEvent, true>

interface NegativeIntentContext {
  intentHash: Hex
  sourceChainId: number
  destinationChainId: number
  transactionHash?: Hex
}

@Injectable()
export class NegativeIntentMonitorService {
  private logger = new Logger(NegativeIntentMonitorService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly publicClient: MultichainPublicClientService,
  ) {}

  /**
   * Start monitoring a negative intent for:
   * 1. Transaction execution on-chain
   * 2. IntentProven event emission
   */
  async monitorNegativeIntent(
    intentHash: Hex,
    sourceChainId: number,
    destinationChainId: number,
    balanceTransactionHash: Hex,
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
    }

    try {
      // Step 1: Wait for the rebalance transaction
      await this.waitForRebalanceTransaction(context)

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

      // Step 2: Wait for IntentProven event
      await this.waitForIntentProven(context)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to monitor negative intent',
          properties: {
            intentHash,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Wait for the negative intent balance transaction to be executed on-chain
   */
  private async waitForRebalanceTransaction(context: NegativeIntentContext): Promise<void> {
    if (!context.transactionHash) return

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Waiting for negative rebalance transaction confirmation...',
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
      })

      if (receipt.status !== 'success') {
        throw new Error('Balance transaction failed')
      }

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
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to confirm negative rebalance transaction',
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
   * Wait for IntentProven event on the source chain
   */
  private async waitForIntentProven(context: NegativeIntentContext): Promise<void> {
    const intentSource = this.getIntentSource(context.sourceChainId)
    if (!intentSource) {
      throw new Error(`No intent source found for chain ${context.sourceChainId}`)
    }

    const client = await this.publicClient.getClient(context.sourceChainId)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Waiting for IntentProven event',
        properties: {
          intentHash: context.intentHash,
          sourceChainId: context.sourceChainId,
          intentSourceAddress: intentSource.sourceAddress,
        },
      }),
    )

    // Set up watcher with a timeout
    const timeout = 300_000 // 5 minutes
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`IntentProven event not detected after ${timeout}ms`)),
        timeout,
      ),
    )

    const eventPromise = new Promise<void>((resolve, reject) => {
      const unwatch = client.watchContractEvent({
        address: intentSource.sourceAddress as Hex,
        abi: IProverAbi,
        eventName: 'IntentProven',
        strict: true,
        args: {
          _hash: context.intentHash,
        },
        onLogs: (logs) => {
          const provenEvent = logs[0] as IntentProvenLog
          this.logger.log(
            EcoLogMessage.fromDefault({
              message: 'IntentProven event detected',
              properties: {
                intentHash: context.intentHash,
                blockNumber: provenEvent.blockNumber?.toString(),
                transactionHash: provenEvent.transactionHash,
              },
            }),
          )
          unwatch()
          resolve()
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
          unwatch()
          reject(error)
        },
      })
    })

    // Wait for either the event or timeout
    await Promise.race([eventPromise, timeoutPromise])
  }

  private getIntentSource(chainId: number) {
    const intentSources = this.ecoConfigService.getIntentSources()
    return intentSources.find((source) => source.chainID === chainId)
  }
}
