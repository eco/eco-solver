import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue, JobsOptions } from 'bull'
import { Hex, erc20Abi, zeroHash, WatchContractEventReturnType } from 'viem'
import { KernelAccountClientService } from '@libs/integrations/blockchain'
import { EcoConfigService } from '@libs/integrations/aws'
import { QUEUES } from '@libs/messaging'
import { EcoLogMessage } from '@libs/shared/logging'
import { EcoError } from '@libs/shared/errors'
import { ViemEventLog } from '@libs/shared/types'
import { convertBigIntsToStrings, getIntentJobId } from '@libs/shared/utils'
import { Network } from '@libs/shared/constants'

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
