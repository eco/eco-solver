import { Queue, JobsOptions } from 'bullmq'
import { Hex } from 'viem'
import {
  USDT0LiFiDestinationSwapJobManager,
  type USDT0LiFiDestinationSwapJob,
  type USDT0LiFiDestinationSwapJobData,
} from '@/liquidity-manager/jobs/usdt0-lifi-destination-swap.job'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'

function makeQueueMock() {
  return {
    add: jest.fn<Promise<any>, [string, any, JobsOptions | undefined]>(),
  } as unknown as jest.Mocked<Queue>
}

function makeProcessorMock(overrides?: Partial<LiquidityManagerProcessor>) {
  const baseQueue = makeQueueMock()
  const execute: jest.Mock<Promise<any>, [string, any]> = jest.fn()
  const processor = {
    queue: baseQueue,
    liquidityManagerService: {
      liquidityProviderManager: {
        execute,
      },
    },
    logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...(overrides as any),
  } as LiquidityManagerProcessor & {
    liquidityManagerService: { liquidityProviderManager: { execute } }
  }
  return processor
}

function makeJob(
  data: Partial<USDT0LiFiDestinationSwapJobData>,
  returnvalue?: { txHash: Hex; finalAmount: string },
): USDT0LiFiDestinationSwapJob {
  const base: USDT0LiFiDestinationSwapJobData = {
    destinationChainId: 10,
    walletAddress: '0xwallet',
    destinationSwapQuote: {
      id: 'q-1',
      fromToken: { address: '0xfrom', decimals: 6, chainId: 10 } as any,
      toToken: { address: '0xto', decimals: 6, chainId: 10 } as any,
      fromAmount: '1000000',
      toAmount: '990000',
      toAmountMin: '985000',
    } as any,
    originalTokenOut: { address: '0xusdt' as Hex, chainId: 10, decimals: 6 },
    groupID: 'grp-1',
    rebalanceJobID: 'reb-1',
    id: 'job-1',
  }

  return {
    id: 'bull-id-1',
    name: LiquidityManagerJobName.USDT0_LIFI_DESTINATION_SWAP,
    data: { ...base, ...data },
    opts: {} as any,
    attemptsMade: 0,
    returnvalue: returnvalue as any,
  } as unknown as USDT0LiFiDestinationSwapJob
}

describe('USDT0LiFiDestinationSwapJobManager', () => {
  let mgr: USDT0LiFiDestinationSwapJobManager
  beforeEach(() => {
    mgr = new USDT0LiFiDestinationSwapJobManager()
  })

  it('start() enqueues with expected options', async () => {
    const queue = makeQueueMock()
    const data = makeJob({}).data
    await USDT0LiFiDestinationSwapJobManager.start(queue, data)
    expect(queue.add).toHaveBeenCalledWith(
      LiquidityManagerJobName.USDT0_LIFI_DESTINATION_SWAP,
      data,
      expect.objectContaining({
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    )
  })

  it('process() builds temp quote and calls execute()', async () => {
    const processor = makeProcessorMock()
    const job = makeJob({})
    await mgr['executeDestinationSwap'](
      processor as any,
      job.data.destinationSwapQuote,
      job.data.walletAddress,
      job.data.destinationChainId,
    )

    expect(
      processor.liquidityManagerService.liquidityProviderManager.execute,
    ).toHaveBeenCalledTimes(1)
  })
})
