import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex, Log, PublicClient, Transaction, Block, getAddress } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { QUEUES } from '@/common/redis/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { getWatchJobId } from '@/common/utils/strings'

@Injectable()
export class WatchNativeService extends WatchEventService<Solver> {
  protected logger = new Logger(WatchNativeService.name)

  constructor(
    @InjectQueue(QUEUES.BALANCE_MONITOR.queue) protected readonly queue: Queue,
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
    const eocAddress = await this.getEOCAddress(solver)

    if (!eocAddress) {
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
        await this.processBlock(block, solver, eocAddress)
      },
      onError: async (error) => await this.onError(error, client, solver),
      includeTransactions: true, // Include transactions in the block
    })

    // Store unwatch function
    this.unwatch[solver.chainID] = [unwatchBlocks]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Subscribed to native transfers for solver',
        properties: {
          chainID: solver.chainID,
          network: solver.network,
          solverAddress: eocAddress,
        },
      }),
    )
  }

  /**
   * Process a block to find native token transfers involving the solver
   */
  private async processBlock(block: Block, solver: Solver, eocAddress: Hex): Promise<void> {
    try {
      // Filter transactions that involve the solver and have value > 0
      const relevantTransactions = (block.transactions as Transaction[]).filter(
        (tx) =>
          typeof tx !== 'string' &&
          tx.value > 0n &&
          tx.to &&
          tx.from && // Ensure both to and from are defined
          (getAddress(tx.to) === getAddress(eocAddress) ||
            getAddress(tx.from) === getAddress(eocAddress)),
      )

      if (relevantTransactions.length > 0) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Found native transfers for solver',
            properties: {
              chainID: solver.chainID,
              blockNumber: block.number?.toString(),
              transactionCount: relevantTransactions.length,
              eocAddress: eocAddress,
            },
          }),
        )

        // Process each relevant transaction
        for (const tx of relevantTransactions) {
          await this.processNativeTransfer(tx, block, solver, eocAddress)
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
    eocAddress: Hex,
  ): Promise<void> {
    try {
      const direction =
        getAddress(transaction.to!) === getAddress(eocAddress) ? 'incoming' : 'outgoing'
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

      // Create a job to record the balance change
      await this.createNativeBalanceChangeJob(solver, transaction, block, direction)
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
   * Create a job to record a native balance change
   */
  private async createNativeBalanceChangeJob(
    solver: Solver,
    transaction: Transaction,
    block: Block,
    direction: 'incoming' | 'outgoing',
  ): Promise<void> {
    try {
      const balanceChangeData = {
        chainId: solver.chainID.toString(),
        address: 'native', // Changed from tokenAddress to address
        changeAmount: transaction.value.toString(),
        direction,
        blockNumber: (block.number || 0n).toString(),
        blockHash: block.hash,
        transactionHash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
      }

      const serializedData = convertBigIntsToStrings(balanceChangeData)
      const jobId = getWatchJobId('watch-native-balance-change', transaction.hash, 0)

      // Add balance update job to BALANCE_MONITOR queue
      await this.queue.add(QUEUES.BALANCE_MONITOR.jobs.update_balance_change, serializedData, {
        jobId,
        ...this.watchJobConfig,
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Native balance change job created',
          properties: {
            chainID: solver.chainID,
            transactionHash: transaction.hash,
            blockNumber: block.number?.toString(),
            direction,
            amount: transaction.value.toString(),
            jobId,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error creating native balance change job',
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
   * Get the eoc solver address for watching native transfers
   */
  private async getEOCAddress(solver: Solver): Promise<Hex | null> {
    try {
      // Get the kernel account client which has the solver's address
      const kernelClient = await this.kernelAccountClientService.getClient(solver.chainID)

      if (kernelClient?.account?.address) {
        return kernelClient?.account?.address as Hex
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
