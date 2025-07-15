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
import { getVMType, VMType } from '@/eco-configs/eco-config.types'
import { SvmMultichainClientService } from '../transaction/svm-multichain-client.service'
import { Address as SvmAddress, createSolanaRpcSubscriptions, RpcSubscriptions, SolanaRpcSubscriptionsApi } from '@solana/kit'

@Injectable()
export class BalanceWebsocketService implements OnApplicationBootstrap, OnModuleDestroy {
  private logger = new Logger(BalanceWebsocketService.name)
  private intentJobConfig: JobsOptions
  private unwatch: Record<string, WatchContractEventReturnType> = {}
  private solanaSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi> | null = null
  private solanaAbortControllers: AbortController[] = []

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
      for (const abortController of this.solanaAbortControllers) {
        abortController.abort()
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
        const vmType = getVMType(solver.chainID)
        
        if (vmType === VMType.SVM) {
          await this.subscribeSolanaTransfers(solver)
        } else {
          const client = await this.kernelAccountClientService.getClient(solver.chainID)
          
          Object.entries(solver.targets).forEach(([address, source]) => {
            if (source.contractType === 'erc20') {
              this.unwatch[`${solver.chainID}-${address}`] = client.watchContractEvent({
                address: address as Hex,
                abi: erc20Abi,
                eventName: 'Transfer',
                // restrict transfers from anyone to the simple account address
                args: { to: client.kernelAccount.address },
                onLogs: this.addJob(solver.network, solver.chainID) as any,
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
      // Get the Solana chain config
      const chainConfig = this.svmMultichainClientService.getChainConfig(solver.chainID)
      console.log("SOLANA chainConfig", chainConfig);
      if (!chainConfig?.websocketUrl) {
        this.logger.warn(`No websocket URL configured for Solana chain ${solver.chainID}`)
        return
      }

      // Create websocket connection using solana/kit
      this.solanaSubscriptions = createSolanaRpcSubscriptions(chainConfig.websocketUrl)
      
      // Get the solver's wallet address
      const solverAddress = this.svmMultichainClientService.getAddress()
      
      // Subscribe to account notifications for the solver address to detect incoming transfers
      const abortController = new AbortController()
      const notifications = await this.solanaSubscriptions
        .accountNotifications(solverAddress, { commitment: 'confirmed' })
        .subscribe({ abortSignal: abortController.signal })
      
      // Process notifications asynchronously
      ;(async () => {
        try {
          for await (const notification of notifications) {
            this.logger.debug(
              EcoLogMessage.fromDefault({
                message: `solana-ws: account notification`,
                properties: {
                  address: solverAddress,
                  notification: notification,
                  chainID: solver.chainID,
                },
              }),
            )
            
            // Process the notification as a transfer event
            this.processSolanaTransfer(notification, solver)
          }
        } catch (error) {
          this.logger.error(
            EcoLogMessage.withError({
              message: `Error processing Solana notifications`,
              error,
              properties: {
                chainID: solver.chainID,
              },
            }),
          )
        }
      })()
      
      // Store the abort controller for cleanup
      this.solanaAbortControllers.push(abortController)
      
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Solana websocket subscribed`,
          properties: {
            chainID: solver.chainID,
            address: solverAddress,
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
      const transferEvent = {
        sourceChainID: BigInt(solver.chainID),
        sourceNetwork: solver.network,
        accountInfo: accountInfo,
        timestamp: Date.now(),
      }

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
      const logTasks = logs.map((transferEvent) => {
        transferEvent.sourceChainID = BigInt(chainID)
        //add network to the event
        transferEvent.sourceNetwork = network

        //bigint as it cant serialize to json
        transferEvent = convertBigIntsToStrings(transferEvent)
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `ws: balance transfer`,
            properties: {
              transferEvent: transferEvent,
            },
          }),
        )
        //add to processing queue
        return this.ethQueue.add(QUEUES.ETH_SOCKET.jobs.erc20_balance_socket, transferEvent, {
          jobId: getIntentJobId(
            'websocket',
            transferEvent.transactionHash ?? zeroHash,
            transferEvent.logIndex ?? 0,
          ),
          ...this.intentJobConfig,
        })
      })
      await Promise.all(logTasks)
    }
  }
}
