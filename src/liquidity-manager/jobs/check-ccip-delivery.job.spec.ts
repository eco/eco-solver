import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Queue, UnrecoverableError } from 'bullmq'
import { CheckCCIPDeliveryJobManager } from './check-ccip-delivery.job'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { CheckCCIPDeliveryJob } from '@/liquidity-manager/jobs/check-ccip-delivery.job'
import { TRANSFER_STATUS_FROM_BLOCK_SHIFT } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-abis'
import { TransferStatus } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-client'

const mockCcipClient = {
  getFee: jest.fn(),
  getOnRampAddress: jest.fn(),
  getTransferStatus: jest.fn(),
}

jest.mock('@/liquidity-manager/services/liquidity-providers/CCIP/ccip-client', () => ({
  createClient: jest.fn(() => mockCcipClient),
  TransferStatus: {
    Untouched: 0,
    InProgress: 1,
    Success: 2,
    Failure: 3,
  },
}))

describe('CheckCCIPDeliveryJobManager', () => {
  let manager: CheckCCIPDeliveryJobManager
  let ecoConfigService: DeepMocked<EcoConfigService>
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let rebalanceRepository: DeepMocked<RebalanceRepository>

  const buildJob = (
    overrides: Partial<CheckCCIPDeliveryJob['data']> = {},
    attemptsMade = 0,
  ): CheckCCIPDeliveryJob =>
    ({
      name: LiquidityManagerJobName.CHECK_CCIP_DELIVERY,
      id: 'job-id',
      data: {
        groupID: 'group',
        rebalanceJobID: 'rebalance',
        id: 'ccip-job',
        sourceChainId: 1,
        destinationChainId: 2,
        sourceChainSelector: '111',
        destinationChainSelector: '222',
        sourceRouter: '0x1111111111111111111111111111111111111111',
        destinationRouter: '0x2222222222222222222222222222222222222222',
        messageId: '0x3333333333333333333333333333333333333333',
        txHash: '0x4444444444444444444444444444444444444444',
        walletAddress: '0x5555555555555555555555555555555555555555',
        fromBlockNumber: '0',
        ...overrides,
      },
      attemptsMade,
      opts: { attempts: 3 },
      moveToDelayed: jest.fn(),
      updateData: jest.fn(),
      token: 'token',
    }) as unknown as CheckCCIPDeliveryJob

  beforeEach(() => {
    jest.clearAllMocks()

    manager = new CheckCCIPDeliveryJobManager()
    ecoConfigService = createMock<EcoConfigService>()
    publicClientService = createMock<MultichainPublicClientService>()
    rebalanceRepository = createMock<RebalanceRepository>()
    ;(manager as any).ecoConfigService = ecoConfigService
    ;(manager as any).publicClientService = publicClientService
    ;(manager as any).rebalanceRepository = rebalanceRepository
    ;(manager as any).liquidityManagerQueue = createMock<Queue>()

    ecoConfigService.getCCIP.mockReturnValue({
      delivery: { backoffMs: 5_000, maxAttempts: 3 },
    } as any)
    publicClientService.getClient.mockResolvedValue({} as any)
  })

  it('confirms delivery when transfer succeeds', async () => {
    mockCcipClient.getTransferStatus.mockResolvedValue(TransferStatus.Success)

    const result = await manager.process(buildJob(), {} as any)

    expect(result).toEqual({ status: 'complete' })
    expect(mockCcipClient.getTransferStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationRouterAddress: '0x2222222222222222222222222222222222222222',
        sourceChainSelector: '111',
        fromBlockNumber: 0n,
      }),
    )
  })

  it('throws an unrecoverable error when transfer fails permanently', async () => {
    mockCcipClient.getTransferStatus.mockResolvedValue(TransferStatus.Failure)

    await expect(manager.process(buildJob(), {} as any)).rejects.toBeInstanceOf(UnrecoverableError)
  })

  it('delays the job when transfer is still pending', async () => {
    mockCcipClient.getTransferStatus.mockResolvedValue(TransferStatus.InProgress)
    const delaySpy = jest.spyOn(manager as any, 'delay').mockResolvedValue(undefined)

    const job = buildJob()
    const result = await manager.process(job, {} as any)

    expect(result).toEqual({ status: 'pending' })
    expect(job.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ pollCount: 1, fromBlockNumber: '0' }),
    )
    expect(delaySpy).toHaveBeenCalledWith(job, 5_000)
  })

  it('fails when pending after exhausting poll attempts', async () => {
    mockCcipClient.getTransferStatus.mockResolvedValue(TransferStatus.InProgress)
    const delaySpy = jest.spyOn(manager as any, 'delay').mockResolvedValue(undefined)
    const job = buildJob({ pollCount: 1 })
    job.opts.attempts = 2

    // Override config so that we exhaust exactly on this tick.
    ecoConfigService.getCCIP.mockReturnValue({
      delivery: { backoffMs: 5_000, maxAttempts: 2 },
    } as any)

    await expect(manager.process(job, {} as any)).rejects.toBeInstanceOf(UnrecoverableError)

    expect(job.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ pollCount: 2, fromBlockNumber: '0' }),
    )
    expect(delaySpy).not.toHaveBeenCalled()
  })

  it('derives a fallback fromBlockNumber when missing', async () => {
    const job = buildJob({ fromBlockNumber: undefined })
    const client = { getBlockNumber: jest.fn().mockResolvedValue(500n) }
    publicClientService.getClient.mockResolvedValue(client as any)
    mockCcipClient.getTransferStatus.mockResolvedValue(TransferStatus.InProgress)
    const delaySpy = jest.spyOn(manager as any, 'delay').mockResolvedValue(undefined)

    await manager.process(job, {} as any)

    const expectedFromBlock = (500n - TRANSFER_STATUS_FROM_BLOCK_SHIFT).toString()
    expect(mockCcipClient.getTransferStatus).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlockNumber: BigInt(expectedFromBlock) }),
    )
    expect(job.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlockNumber: expectedFromBlock }),
    )
    expect(delaySpy).toHaveBeenCalled()
  })

  it('marks rebalance as completed on successful completion', async () => {
    const job = buildJob()
    job.returnvalue = { status: 'complete' }

    await manager.onComplete(job, {} as any)

    expect(rebalanceRepository.updateStatus).toHaveBeenCalledWith(
      'rebalance',
      RebalanceStatus.COMPLETED,
    )
  })

  it('marks rebalance as failed on final attempt', async () => {
    const job = buildJob()
    jest.spyOn(manager as any, 'isFinalAttempt').mockReturnValue(true)

    await manager.onFailed(job, {} as any, new Error('fail'))

    expect(rebalanceRepository.updateStatus).toHaveBeenCalledWith(
      'rebalance',
      RebalanceStatus.FAILED,
    )
  })

  it('skips failure update when retries remain', async () => {
    const job = buildJob()
    jest.spyOn(manager as any, 'isFinalAttempt').mockReturnValue(false)

    await manager.onFailed(job, {} as any, new Error('fail'))

    expect(rebalanceRepository.updateStatus).not.toHaveBeenCalled()
  })
})
