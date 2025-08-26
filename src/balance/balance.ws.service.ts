import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Network } from '@/common/alchemy/network'
import { JobsOptions, Queue } from 'bullmq'
import { QUEUES } from '../common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { ViemEventLog } from '../common/events/viem'
import { erc20Abi, Hex, WatchContractEventReturnType, zeroHash } from 'viem'
import { convertBigIntsToStrings } from '../common/viem/utils'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { getIntentJobId } from '../common/utils/strings'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { EcoError } from '@/common/errors/eco-error'
import { getVmType, VmType } from '@/eco-configs/eco-config.types'
import { SvmMultichainClientService } from '../transaction/svm-multichain-client.service'
import { PublicKey, Connection } from '@solana/web3.js'

@Injectable()
export class BalanceWebsocketService implements OnApplicationBootstrap, OnModuleDestroy {
  private logger = new Logger(BalanceWebsocketService.name)
  private intentJobConfig: JobsOptions
  private unwatch: Record<string, WatchContractEventReturnType> = {}
  private solanaSubscriptions: Array<{ subscriptionId: number; connection: any; chainID: number }> = []

  constructor(
    @InjectQueue(QUEUES.ETH_SOCKET.queue) private readonly ethQueue: Queue,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly svmMultichainClientService: SvmMultichainClientService,
  ) {}

  async onApplicationBootstrap() {
    await this.subscribeWS()
  }

  async onModuleDestroy() {
    // close all websockets
    try {
      Object.values(this.unwatch).forEach((unwatch) => unwatch())
    } catch (e) {
      this.logger.error(
        EcoLogMessage.withError({
          message: `watch-event: unsubscribe`,
          error: EcoError.WatchEventUnsubscribeError,
          properties: {
            errorPassed: e,
          },
        }),
      )
    }

    // close Solana subscriptions
    try {
      for (const subscription of this.solanaSubscriptions) {
        await subscription.connection.removeAccountChangeListener(subscription.subscriptionId)
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `solana-ws: unsubscribed`,
            properties: {
              subscriptionId: subscription.subscriptionId,
              chainID: subscription.chainID,
            },
          }),
        )
      }
    } catch (e) {
      this.logger.error(
        EcoLogMessage.withError({
          message: `solana-ws: unsubscribe`,
          error: EcoError.WatchEventUnsubscribeError,
          properties: {
            errorPassed: e,
          },
        }),
      )
    }
  }

  async subscribeWS() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig

    const websocketTasks = Object.entries(this.ecoConfigService.getSolvers()).map(
      async ([, solver]) => {
      const vmType = getVmType(solver.chainID)
              
      if (vmType === VmType.SVM) {
        await this.subscribeSolanaTransfers(solver)
      } else {
        const client = await this.kernelAccountClientService.getClient(solver.chainID)
        // const instanceAddress = this.alchemyService.getWallet(solver.network).address

        Object.entries(solver.targets).forEach(([address, source]) => {
          // const [address, source] = targetEntity
          if (source.contractType === 'erc20') {
            this.unwatch[`${solver.chainID}-${address}`] = client.watchContractEvent({
              address: address as Hex,
              abi: erc20Abi,
              eventName: 'Transfer',
              // restrict transfers from anyone to the simple account address
              args: { to: client.kernelAccount.address },
              onLogs: this.addJob(solver.network, solver.chainID) as any,
              onError: (error) => {
                this.logger.error(
                  EcoLogMessage.withError({
                    message: 'ws: balance event error',
                    error,
                  }),
                )
              },
            })
          }
        })
      }
      },
    )
    await Promise.all(websocketTasks)
  }

  private async subscribeSolanaTransfers(solver: any) {
    try {
      // Get the Solana connection from web3.js
      const connection = await this.svmMultichainClientService.getConnection(solver.chainID)
      
      // Get the solver's wallet address and convert to PublicKey
      const solverPubkey = this.svmMultichainClientService.getAddress()
      
      // Subscribe to account notifications for the solver address to detect incoming transfers
      // Store subscription ID for cleanup
      const subscriptionId = connection.onAccountChange(
        solverPubkey,
        (accountInfo, context) => {
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `solana-ws: account notification`,
              properties: {
                address: solverPubkey,
                accountInfo: accountInfo,
                slot: context.slot,
                chainID: solver.chainID,
              },
            }),
          )
          
          // Process the notification as a transfer event
          const notification = {
            accountInfo: {
              lamports: accountInfo.lamports,
              data: accountInfo.data,
              owner: accountInfo.owner.toString(),
              executable: accountInfo.executable,
              rentEpoch: accountInfo.rentEpoch,
            },
            slot: context.slot,
          }
          this.processSolanaTransfer(notification, solver)
        },
        'confirmed'
      )
      
      // Store the subscription info for cleanup
      this.solanaSubscriptions.push({
        subscriptionId,
        connection,
        chainID: solver.chainID,
      })
      
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Solana websocket subscribed`,
          properties: {
            chainID: solver.chainID,
            address: solverPubkey,
            subscriptionId,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: `Failed to subscribe to Solana transfers`,
          error,
          properties: {
            chainID: solver.chainID,
          },
        }),
      )
    }
  }

  private async processSolanaTransfer(accountInfo: any, solver: any) {
    try {
      let transferEvent = {
        sourceChainID: BigInt(solver.chainID),
        sourceNetwork: solver.network,
        accountInfo: accountInfo,
        timestamp: Date.now(),
      }

      transferEvent = convertBigIntsToStrings(transferEvent)

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `solana-ws: balance transfer`,
          properties: {
            transferEvent: transferEvent,
          },
        }),
      )

      await this.ethQueue.add(QUEUES.ETH_SOCKET.jobs.erc20_balance_socket, transferEvent, {
        jobId: getIntentJobId(
          'solana-websocket',
          accountInfo.signature || 'unknown',
          0,
        ),
        ...this.intentJobConfig,
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: `Failed to process Solana transfer`,
          error,
          properties: {
            chainID: solver.chainID,
          },
        }),
      )
    }
  }

  addJob(network: Network, chainID: number) {
    return async (logs: ViemEventLog[]) => {
      const tasks: Promise<any>[] = []
      const jobIds: string[] = []

      for (let i = 0; i < logs.length; i++) {
        let transferEvent = logs[i]
        transferEvent.sourceChainID = BigInt(chainID)
        transferEvent.sourceNetwork = network

        transferEvent = convertBigIntsToStrings(transferEvent)
        const jobId = getIntentJobId(
          'websocket',
          transferEvent.transactionHash ?? zeroHash,
          transferEvent.logIndex ?? 0,
        )
        jobIds.push(jobId)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `ws: balance transfer`,
            properties: {
              transferEvent: transferEvent,
              jobId,
            },
          }),
        )

        tasks.push(
          this.ethQueue.add(QUEUES.ETH_SOCKET.jobs.erc20_balance_socket, transferEvent, {
            jobId,
            ...this.intentJobConfig,
          }),
        )
      }

      const results = await Promise.allSettled(tasks)
      const failures = results
        .map((r, idx) => ({ r, idx }))
        .filter((x) => x.r.status === 'rejected') as unknown as {
        r: PromiseRejectedResult
        idx: number
      }[]

      if (failures.length > 0) {
        // Log each failed item with its jobId
        for (const f of failures) {
          const reason = f.r.reason instanceof Error ? f.r.reason.message : String(f.r.reason)
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `ws: balance queue add failed`,
              properties: {
                jobId: jobIds[f.idx],
                reason,
              },
            }),
          )
        }

        // Log summarized failure counts
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `ws: balance addJob: ${failures.length}/${logs.length} jobs failed to be added to queue`,
            properties: {
              failures: failures.map((f) =>
                f.r.reason instanceof Error ? f.r.reason.message : String(f.r.reason),
              ),
            },
          }),
        )
      }
    }
  }
}
