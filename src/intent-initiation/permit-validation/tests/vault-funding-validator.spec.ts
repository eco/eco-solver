import { createMock } from '@golevelup/ts-jest'
import { EcoError } from '@/common/errors/eco-error'
import { PublicClient } from 'viem'
import { ValidateVaultFundingArgs } from '@/intent-initiation/permit-validation/interfaces/validate-vault-funding-args.interface'
import { VaultFundingValidator, VaultStatus } from '@/intent-initiation/permit-validation/vault-funding-validator'

describe('VaultFundingValidator', () => {
  const intentHash = '0xabc123'
  const intentSourceAddress = '0xIntentSource'

  const mockClient = createMock<PublicClient>({
    readContract: jest.fn(),
  })

  const buildArgs = (status: VaultStatus, preventRedundantFunding = true): ValidateVaultFundingArgs => {
    ;(mockClient.readContract as jest.Mock).mockResolvedValueOnce({
      status,
    })

    return {
      client: mockClient,
      intentHash,
      intentSourceAddress,
      preventRedundantFunding,
    }
  }

  describe('validateVaultFunding()', () => {
    it('should return error if vault is claimed', async () => {
      const res = await VaultFundingValidator.validateVaultFunding(buildArgs(VaultStatus.CLAIMED))
      expect(res).toEqual({ error: EcoError.VaultAlreadyClaimed })
    })

    it('should return error if vault is fully funded and preventRedundantFunding = true', async () => {
      const res = await VaultFundingValidator.validateVaultFunding(buildArgs(VaultStatus.FULLY_FUNDED, true))
      expect(res).toEqual({ error: EcoError.VaultAlreadyFunded })
    })

    it('should pass with warning if vault is fully funded but preventRedundantFunding = false', async () => {
      const res = await VaultFundingValidator.validateVaultFunding(buildArgs(VaultStatus.FULLY_FUNDED, false))
      expect(res).toEqual({})
    })

    it('should return error if vault is not yet fully funded (EMPTY)', async () => {
      const res = await VaultFundingValidator.validateVaultFunding(buildArgs(VaultStatus.EMPTY))
      expect(res).toEqual({ error: EcoError.VaultNotFullyFundedAfterPermit })
    })

    it('should return error if vault is not yet fully funded (PARTIALLY_FUNDED)', async () => {
      const res = await VaultFundingValidator.validateVaultFunding(buildArgs(VaultStatus.PARTIALLY_FUNDED))
      expect(res).toEqual({ error: EcoError.VaultNotFullyFundedAfterPermit })
    })

    it('should pass if vault is fully funded and preventRedundantFunding = false', async () => {
      const res = await VaultFundingValidator.validateVaultFunding(buildArgs(VaultStatus.FULLY_FUNDED, false))
      expect(res).toEqual({})
    })
  })

  describe('isVaultFunded()', () => {
    it('should return true if vault is fully funded', async () => {
      const args = buildArgs(VaultStatus.FULLY_FUNDED)
      const result = await VaultFundingValidator.isVaultFunded(args)
      expect(result).toBe(true)
    })

    it('should return true if vault is claimed', async () => {
      const args = buildArgs(VaultStatus.CLAIMED)
      const result = await VaultFundingValidator.isVaultFunded(args)
      expect(result).toBe(true)
    })

    it('should return false if vault is not yet fully funded', async () => {
      const args = buildArgs(VaultStatus.PARTIALLY_FUNDED)
      const result = await VaultFundingValidator.isVaultFunded(args)
      expect(result).toBe(false)
    })
  })

  describe('isVaultStale()', () => {
    it('should return true if vault is CLAIMED or FULLY_FUNDED', () => {
      expect(VaultFundingValidator.isVaultStale(VaultStatus.CLAIMED)).toBe(true)
      expect(VaultFundingValidator.isVaultStale(VaultStatus.FULLY_FUNDED)).toBe(true)
    })

    it('should return false for all other statuses', () => {
      expect(VaultFundingValidator.isVaultStale(VaultStatus.EMPTY)).toBe(false)
      expect(VaultFundingValidator.isVaultStale(VaultStatus.PARTIALLY_FUNDED)).toBe(false)
      expect(VaultFundingValidator.isVaultStale(VaultStatus.Refunded)).toBe(false)
    })
  })
})
