import { createMock, DeepMocked } from '@golevelup/ts-jest'
import {
  CheckCCTPAttestationJob,
  CheckCCTPAttestationJobManager,
} from '@eco-solver/liquidity-manager/jobs/check-cctp-attestation.job'
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor'
import { ExecuteCCTPMintJobManager } from '@eco-solver/liquidity-manager/jobs/execute-cctp-mint.job'

describe('CheckCCTPAttestationJobManager', () => {
  let checkCCTPAttestationJobManager: CheckCCTPAttestationJobManager
  let liquidityManagerProcessor: DeepMocked<LiquidityManagerProcessor>

  const checkCCTPAttestationJob: Partial<CheckCCTPAttestationJob> = {
    data: {
      destinationChainId: 10,
      messageHash: '0x0000000000000000000000000000000000000000000000000000000000000123',
      messageBody: '0x123',
    },
  }

  beforeEach(async () => {
    liquidityManagerProcessor = createMock<LiquidityManagerProcessor>()
    checkCCTPAttestationJobManager = new CheckCCTPAttestationJobManager()

    ExecuteCCTPMintJobManager.start = jest.fn()
    CheckCCTPAttestationJobManager.start = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('process', () => {
    it('should fetch attestation', async () => {
      await checkCCTPAttestationJobManager.process(
        checkCCTPAttestationJob as CheckCCTPAttestationJob,
        liquidityManagerProcessor,
      )

      const mockFetchAttestation = jest.spyOn(
        liquidityManagerProcessor.cctpProviderService,
        'fetchAttestation',
      )

      expect(mockFetchAttestation).toHaveBeenCalledWith(checkCCTPAttestationJob.data?.messageHash)
    })
  })

  describe('onComplete', () => {
    it('should start a new job if attestation is still pending', async () => {
      const pendingCheckCCTPAttestationJob: Partial<CheckCCTPAttestationJob> = {
        ...checkCCTPAttestationJob,
        returnvalue: { status: 'pending' },
      }

      await checkCCTPAttestationJobManager.onComplete(
        pendingCheckCCTPAttestationJob as CheckCCTPAttestationJob,
        liquidityManagerProcessor,
      )

      expect(ExecuteCCTPMintJobManager.start).not.toHaveBeenCalled()
      expect(CheckCCTPAttestationJobManager.start).toHaveBeenCalled()
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
