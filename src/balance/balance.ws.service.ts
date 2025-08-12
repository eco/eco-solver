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

@Injectable()
export class BalanceWebsocketService implements OnApplicationBootstrap, OnModuleDestroy {
  private logger = new Logger(BalanceWebsocketService.name)
  private intentJobConfig: JobsOptions
  private unwatch: Record<string, WatchContractEventReturnType> = {}

  constructor(
    @InjectQueue(QUEUES.ETH_SOCKET.queue) private readonly ethQueue: Queue,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly ecoConfigService: EcoConfigService,
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
  }

  async subscribeWS() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig

    const websocketTasks = Object.entries(this.ecoConfigService.getSolvers()).map(
      async ([, solver]) => {
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
      },
    )
    await Promise.all(websocketTasks)
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
