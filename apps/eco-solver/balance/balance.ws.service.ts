import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { EcoConfigService } from '@eco/infrastructure-config'
import { Network } from '@/common/alchemy/network'
import { JobsOptions, Queue } from 'bullmq'
import { QUEUES } from '../common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { ViemEventLog } from '../common/events/viem'
import { erc20Abi, Hex, WatchContractEventReturnType, zeroHash } from 'viem'
import { convertBigIntsToStrings } from '../common/viem/utils'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { getIntentJobId } from '@eco/utils'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { EcoError } from '@/common/errors/eco-error'

@Injectable()
export class BalanceWebsocketService implements OnApplicationBootstrap, OnModuleDestroy {
  private logger = new Logger(BalanceWebsocketService.name)
  private intentJobConfig!: JobsOptions
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
              onLogs: this.addJob(solver.network as Network, solver.chainID) as any,
            })
          }
        })
      },
    )
    await Promise.all(websocketTasks)
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
