import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { erc20Abi, Hex, Log, PublicClient } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { QUEUES } from '@/common/redis/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getWatchJobId } from '@/common/utils/strings'
import { ERC20TransferLog } from '@/contracts'
import * as BigIntSerializer from '@/common/utils/serialize'

@Injectable()
export class WatchTokensService extends WatchEventService<Solver> {
  protected logger = new Logger(WatchTokensService.name)

  constructor(
    @InjectQueue(QUEUES.BALANCE_MONITOR.queue) protected readonly queue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {
    super(queue, publicClientService, ecoConfigService)
  }

  /**
   * Subscribe to Transfer events for all ERC20 tokens across all solver configurations
   */
  async subscribe(): Promise<void> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Starting token transfer monitoring for all solvers',
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
            message: 'Failed to subscribe to solver tokens',
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
        message: 'Token transfer monitoring initialized',
        properties: {
          solvers: Object.keys(solvers).length,
        },
      }),
    )
  }

  /**
   * Subscribe to Transfer events for a specific solver's ERC20 tokens
   */
  async subscribeTo(client: PublicClient, solver: Solver): Promise<void> {
    const solverAddress = await this.getSolverAddress(solver)

    if (!solverAddress) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'No solver address found, skipping token monitoring',
          properties: {
            chainID: solver.chainID,
            network: solver.network,
          },
        }),
      )
      return
    }

    const erc20Targets = Object.entries(solver.targets).filter(
      ([, target]) => target.contractType === 'erc20',
    )

    if (erc20Targets.length === 0) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'No ERC20 targets found for solver',
          properties: {
            chainID: solver.chainID,
            network: solver.network,
          },
        }),
      )
      return
    }

    // Get all ERC20 token addresses for this solver
    const tokenAddresses = erc20Targets.map(([address]) => address as Hex)

    // Watch for both incoming and outgoing transfers using OR logic
    // This captures transfers where the solver is either the sender OR receiver
    const unwatchOutgoingTransfers = client.watchContractEvent({
      address: tokenAddresses,
      abi: erc20Abi,
      eventName: 'Transfer',
      args: {
        // Filter for transfers involving the solver address
        to: [solverAddress], // incoming transfers
      },
      onLogs: this.addJob(solver),
      onError: async (error) => await this.onError(error, client, solver),
    })

    const unwatchIncomingTransfers = client.watchContractEvent({
      address: tokenAddresses,
      abi: erc20Abi,
      eventName: 'Transfer',
      args: {
        // Filter for transfers involving the solver address
        from: [solverAddress], // outgoing transfers
      },
      onLogs: this.addJob(solver),
      onError: async (error) => await this.onError(error, client, solver),
    })

    // Store unwatch function
    this.unwatch[solver.chainID] = [unwatchOutgoingTransfers, unwatchIncomingTransfers]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Subscribed to token transfers for solver',
        properties: {
          chainID: solver.chainID,
          network: solver.network,
          solverAddress,
          tokenCount: tokenAddresses.length,
          tokens: tokenAddresses,
        },
      }),
    )
  }

  /**
   * Create job handler for processing Transfer events
   */
  addJob(solver: Solver): (logs: Log[]) => Promise<void> {
    return async (logs: ERC20TransferLog[]) => {
      for (const log of logs) {
        log.sourceChainID = BigInt(solver.chainID)
        log.sourceNetwork = solver.network

        // bigint as it can't serialize to JSON
        const watchTransfer = BigIntSerializer.serialize(log)
        const jobId = getWatchJobId(
          'watch-token-balance-change',
          watchTransfer.transactionHash,
          watchTransfer.logIndex,
        )
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `watch tokens`,
            properties: { createIntent: watchTransfer, jobId },
          }),
        )
        // Create a job to record the token balance change
        await this.createTokenBalanceChangeJob(solver, log)
      }
    }
  }

  /**
   * Create a job to record a token balance change
   */
  private async createTokenBalanceChangeJob(solver: Solver, log: ERC20TransferLog): Promise<void> {
    try {
      // Get the solver address to determine direction
      const solverAddress = await this.getSolverAddress(solver)
      if (!solverAddress) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'Cannot determine balance change direction without solver address',
            properties: {
              chainID: solver.chainID,
              tokenAddress: log.address,
              transactionHash: log.transactionHash,
            },
          }),
        )
        return
      }

      // Determine if this is incoming or outgoing based on transfer direction
      const direction = log.args.to === solverAddress ? 'incoming' : 'outgoing'

      const balanceChangeData = {
        chainId: solver.chainID.toString(),
        address: log.address, // Changed from tokenAddress to address
        changeAmount: log.args.value.toString(),
        direction,
        blockNumber: log.blockNumber.toString(),
        blockHash: log.blockHash,
        transactionHash: log.transactionHash,
        timestamp: new Date(), // Current timestamp as block timestamp might not be available
        from: log.args.from,
        to: log.args.to,
      }

      const serializedData = BigIntSerializer.serialize(balanceChangeData)
      const jobId = getWatchJobId('watch-token-balance-change', log.transactionHash, log.logIndex)

      // Add balance update job to BALANCE_MONITOR queue
      await this.queue.add(QUEUES.BALANCE_MONITOR.jobs.update_balance, serializedData, {
        jobId,
        ...this.watchJobConfig,
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Token balance change job created',
          properties: {
            chainID: solver.chainID,
            tokenAddress: log.address,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber.toString(),
            direction,
            amount: log.args.value.toString(),
            jobId,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error creating token balance change job',
          properties: {
            chainID: solver.chainID,
            tokenAddress: log.address,
            transactionHash: log.transactionHash,
            error: error.message || error,
          },
        }),
      )
    }
  }

  /**
   * Get the solver address for watching transfers
   * This method handles getting the actual wallet address that will receive/send tokens
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
          message: 'Could not get kernel account address for token monitoring',
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
