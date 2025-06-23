import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex, Log, PublicClient, Transaction, Block, zeroAddress } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WatchEventService } from '../intent/watch-event.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { QUEUES } from '@/common/redis/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { getWatchJobId } from '@/common/utils/strings'
import { zeroHash } from 'viem'

interface NativeTransferEvent {
  chainId: bigint
  network: string
  transactionHash: Hex
  blockNumber: bigint
  blockHash: Hex
  from: Hex
  to: Hex
  value: bigint
  timestamp: Date
  solverAddress: Hex
  direction: 'incoming' | 'outgoing'
  sourceChainID?: bigint
  sourceNetwork?: string
}

@Injectable()
export class WatchNativeService extends WatchEventService<Solver> {
  protected logger = new Logger(WatchNativeService.name)

  constructor(
    @InjectQueue(QUEUES.WATCH_RPC.queue) protected readonly queue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {
    super(queue, publicClientService, ecoConfigService)
  }

  /**
   * Subscribe to block events to monitor native token transfers for all solvers
   */
  async subscribe(): Promise<void> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Starting native token transfer monitoring for all solvers',
      }),
    )

    const solvers = this.ecoConfigService.getSolvers()
    const subscriptionTasks = Object.values(solvers).map(async (solver) => {
      try {
        const client = await this.publicClientService.getClient(solver.chainID)
        await this.subscribeTo(client, solver)
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Failed to subscribe to solver native transfers',
            properties: {
              chainID: solver.chainID,
              network: solver.network,
              error: error.message || error,
            },
          }),
        )
      }
    })

    await Promise.all(subscriptionTasks)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Native token transfer monitoring initialized',
        properties: {
          solvers: Object.keys(solvers).length,
        },
      }),
    )
  }

  /**
   * Subscribe to block events for a specific solver to monitor native transfers
   */
  async subscribeTo(client: PublicClient, solver: Solver): Promise<void> {
    const solverAddress = await this.getSolverAddress(solver)

    if (!solverAddress) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'No solver address found, skipping native monitoring',
          properties: {
            chainID: solver.chainID,
            network: solver.network,
          },
        }),
      )
      return
    }

    // Watch blocks and filter transactions for this solver
    const unwatchBlocks = client.watchBlocks({
      onBlock: async (block: Block) => {
        await this.processBlock(block, solver, solverAddress)
      },
      onError: async (error) => await this.onError(error, client, solver),
    })

    // Store unwatch function
    this.unwatch[solver.chainID] = [unwatchBlocks]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Subscribed to native transfers for solver',
        properties: {
          chainID: solver.chainID,
          network: solver.network,
          solverAddress,
        },
      }),
    )
  }

  /**
   * Process a block to find native token transfers involving the solver
   */
  private async processBlock(block: Block, solver: Solver, solverAddress: Hex): Promise<void> {
    try {
      // Filter transactions that involve the solver and have value > 0
      const relevantTransactions = (block.transactions as Transaction[]).filter(
        (tx) =>
          typeof tx !== 'string' &&
          tx.value > 0n &&
          (tx.to === solverAddress || tx.from === solverAddress),
      )

      if (relevantTransactions.length > 0) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Found native transfers for solver',
            properties: {
              chainID: solver.chainID,
              blockNumber: block.number?.toString(),
              transactionCount: relevantTransactions.length,
              solverAddress,
            },
          }),
        )

        // Process each relevant transaction
        for (const tx of relevantTransactions) {
          await this.processNativeTransfer(tx, block, solver, solverAddress)
        }
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing block for native transfers',
          properties: {
            chainID: solver.chainID,
            blockNumber: block.number?.toString(),
            blockHash: block.hash,
            error: error.message || error,
          },
        }),
      )
    }
  }

  /**
   * Process a native token transfer transaction
   */
  private async processNativeTransfer(
    transaction: Transaction,
    block: Block,
    solver: Solver,
    solverAddress: Hex,
  ): Promise<void> {
    try {
      const direction = transaction.to === solverAddress ? 'incoming' : 'outgoing'

      const nativeTransferEvent: NativeTransferEvent = {
        chainId: BigInt(solver.chainID),
        network: solver.network,
        transactionHash: transaction.hash,
        blockNumber: block.number || 0n,
        blockHash: block.hash || zeroHash,
        from: transaction.from,
        to: transaction.to || zeroAddress,
        value: transaction.value,
        timestamp: new Date(Number(block.timestamp) * 1000),
        solverAddress,
        direction,
        sourceChainID: BigInt(solver.chainID),
        sourceNetwork: solver.network,
      }

      // Serialize for queue processing
      const serializedEvent = convertBigIntsToStrings(nativeTransferEvent)

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Native transfer detected',
          properties: {
            chainID: solver.chainID,
            network: solver.network,
            direction,
            transactionHash: transaction.hash,
            blockNumber: block.number?.toString(),
            value: transaction.value.toString(),
            from: transaction.from,
            to: transaction.to,
          },
        }),
      )

      // Generate unique job ID
      const jobId = getWatchJobId(
        'watch-native',
        transaction.hash,
        0, // Native transfers don't have log index
      )

      // Add to processing queue (using a new job type for native transfers)
      await this.queue.add(QUEUES.WATCH_RPC.jobs.native_balance_socket, serializedEvent, {
        jobId,
        ...this.watchJobConfig,
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing native transfer',
          properties: {
            chainID: solver.chainID,
            transactionHash: transaction.hash,
            error: error.message || error,
          },
        }),
      )
    }
  }

  /**
   * This method is required by the abstract class but not used for native transfers
   * since we're watching blocks, not specific contract events
   */
  addJob(solver: Solver): (logs: Log[]) => Promise<void> {
    return async (logs: Log[]) => {
      // This method is not used for native transfers as we process transactions directly
      // Keeping for interface compliance
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'addJob called for native service (not implemented)',
          properties: {
            chainID: solver.chainID,
            logCount: logs.length,
          },
        }),
      )
    }
  }

  /**
   * Get the solver address for watching native transfers
   */
  private async getSolverAddress(solver: Solver): Promise<Hex | null> {
    try {
      // Get the kernel account client which has the solver's address
      const kernelClient = await this.kernelAccountClientService.getClient(solver.chainID)

      if (kernelClient?.kernelAccount?.address) {
        return kernelClient.kernelAccount.address as Hex
      }

      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Could not get kernel account address for native monitoring',
          properties: {
            chainID: solver.chainID,
            network: solver.network,
          },
        }),
      )

      return null
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error getting solver address from kernel client',
          properties: {
            chainID: solver.chainID,
            network: solver.network,
            error: error.message || error,
          },
        }),
      )
      return null
    }
  }
}
