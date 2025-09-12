// Mock the problematic dependencies first
jest.mock('@/liquidity-manager/processors/eco-protocol-intents.processor', () => ({
  LiquidityManagerProcessor: class MockLiquidityManagerProcessor {},
}))

jest.mock('@/liquidity-manager/jobs/execute-cctp-mint.job', () => ({
  ExecuteCCTPMintJobManager: {
    start: jest.fn(),
  },
}))

jest.mock('@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service', () => ({
  CCTPProviderService: class MockCCTPProviderService {},
}))

import { createMock, DeepMocked } from '@golevelup/ts-jest'
import {
  CheckCCTPAttestationJob,
  CheckCCTPAttestationJobManager,
} from '@/liquidity-manager/jobs/check-cctp-attestation.job'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { ExecuteCCTPMintJobManager } from '@/liquidity-manager/jobs/execute-cctp-mint.job'
import { EcoDbEntity } from '@/common/db/eco-db-entity.enum'

describe('CheckCCTPAttestationJobManager', () => {
  let checkCCTPAttestationJobManager: CheckCCTPAttestationJobManager
  let liquidityManagerProcessor: DeepMocked<LiquidityManagerProcessor>

  const checkCCTPAttestationJob: Partial<CheckCCTPAttestationJob> = {
    data: {
      groupID: EcoDbEntity.REBALANCE_JOB_GROUP.getEntityID(),
      rebalanceJobID: EcoDbEntity.REBALANCE_JOB.getEntityID(),
      destinationChainId: 10,
      messageHash: '0x0000000000000000000000000000000000000000000000000000000000000123',
      messageBody: '0x123',
    },
  }

  beforeEach(async () => {
    liquidityManagerProcessor = createMock<LiquidityManagerProcessor>()
    // Add processorType required by context extractor
    ;(liquidityManagerProcessor as any).processorType = 'liquidity-manager-processor'
    checkCCTPAttestationJobManager = new CheckCCTPAttestationJobManager()

    ExecuteCCTPMintJobManager.start = jest.fn()
    CheckCCTPAttestationJobManager.start = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('process', () => {
    it('should fetch attestation', async () => {
      const mockFetchAttestation = jest
        .spyOn(liquidityManagerProcessor.cctpProviderService, 'fetchAttestation')
        .mockResolvedValueOnce({ status: 'complete', attestation: '0xbeef' } as any)

      await checkCCTPAttestationJobManager.process(
        checkCCTPAttestationJob as CheckCCTPAttestationJob,
        liquidityManagerProcessor,
      )

      expect(mockFetchAttestation).toHaveBeenCalledWith(
        checkCCTPAttestationJob.data?.messageHash,
        checkCCTPAttestationJob.data?.id,
      )
    })
  })

  describe('onComplete', () => {
    it('does nothing when attestation is pending (re-enqueue handled by process delay)', async () => {
      const pendingCheckCCTPAttestationJob: Partial<CheckCCTPAttestationJob> = {
        ...checkCCTPAttestationJob,
        returnvalue: { status: 'pending' },
      }

      await checkCCTPAttestationJobManager.onComplete(
        pendingCheckCCTPAttestationJob as CheckCCTPAttestationJob,
        liquidityManagerProcessor,
      )

      expect(ExecuteCCTPMintJobManager.start).not.toHaveBeenCalled()
      expect(CheckCCTPAttestationJobManager.start).not.toHaveBeenCalled()
    })

    it('should execute mint if attestation is still completed', async () => {
      const pendingCheckCCTPAttestationJob: Partial<CheckCCTPAttestationJob> = {
        ...checkCCTPAttestationJob,
        returnvalue: { status: 'complete', attestation: '0xabcd' },
      }

      await checkCCTPAttestationJobManager.onComplete(
        pendingCheckCCTPAttestationJob as CheckCCTPAttestationJob,
        liquidityManagerProcessor,
      )

      expect(ExecuteCCTPMintJobManager.start).toHaveBeenCalled()
      expect(CheckCCTPAttestationJobManager.start).not.toHaveBeenCalled()
    })
  })
})
