import { EcoError } from '@/common/errors/eco-error'
import { EcoResponse } from '@/common/eco-response'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { ValidateVaultFundingArgs } from '@/intent-initiation/permit-validation/interfaces/validate-vault-funding-args.interface'

/*
IVaultStorage.RewardStatus
    enum RewardStatus {
        Initial,
        PartiallyFunded,
        Funded,
        Claimed,
        Refunded
    }

    Annoyingly, this enum is not exposed externally, so we have to use the internal enum from the contract.
    Why is it not exposed? Who knows.
*/

export enum VaultStatus {
  EMPTY = 0,
  PARTIALLY_FUNDED = 1,
  FULLY_FUNDED = 2,
  CLAIMED = 3,
  Refunded = 4,
}

export class VaultFundingValidator {
  private static logger = new IntentOperationLogger('VaultFundingValidator')

  @LogOperation('intent_validation', IntentOperationLogger)
  static async validateVaultFunding(
    @LogContext args: ValidateVaultFundingArgs,
  ): Promise<EcoResponse<void>> {
    const { client, intentSourceAddress, intentHash, preventRedundantFunding } = args

    const vaultStatus = await this.getVaultStatus({
      client,
      intentSourceAddress,
      intentHash,
    })

    if (vaultStatus === VaultStatus.CLAIMED) {
      // Log business event: vault already claimed
      this.logger.logPermitValidationResult(intentHash, 'vault_funding', false, {
        message: `Vault for intent ${intentHash} has already been claimed`,
        vaultStatus: 'claimed',
      })

      return { error: EcoError.VaultAlreadyClaimed }
    }

    if (vaultStatus === VaultStatus.FULLY_FUNDED) {
      if (preventRedundantFunding) {
        // Log business event: redundant funding prevented
        this.logger.logPermitValidationResult(intentHash, 'vault_funding', false, {
          message: `Vault for intent ${intentHash} is already fully funded`,
          vaultStatus: 'fully_funded',
          preventRedundantFunding: true,
        })

        return { error: EcoError.VaultAlreadyFunded }
      }

      // Log business event: vault already funded but allowing redundant funding
      this.logger.warn({ intentHash }, `Vault for intent ${intentHash} is already funded`, {
        vaultStatus: 'fully_funded',
        preventRedundantFunding: false,
      })

      return {}
    }

    if (vaultStatus < VaultStatus.FULLY_FUNDED) {
      // Log business event: vault not fully funded
      this.logger.logPermitValidationResult(intentHash, 'vault_funding', false, {
        message: `Vault for intent ${intentHash} is not yet fully funded`,
        vaultStatus: this.getVaultStatusName(vaultStatus),
      })

      return { error: EcoError.VaultNotFullyFundedAfterPermit }
    }

    // Log business event: vault validation successful
    this.logger.logPermitValidationResult(intentHash, 'vault_funding', true)

    return {}
  }

  @LogOperation('vault_funding_validation', IntentOperationLogger)
  static async isVaultFunded(@LogContext args: ValidateVaultFundingArgs): Promise<boolean> {
    const status = await this.getVaultStatus(args)
    return status >= VaultStatus.FULLY_FUNDED
  }

  @LogOperation('vault_funding_validation', IntentOperationLogger)
  static isVaultStale(@LogContext status: VaultStatus): boolean {
    return status === VaultStatus.CLAIMED || status === VaultStatus.FULLY_FUNDED
  }

  @LogOperation('vault_funding_validation', IntentOperationLogger)
  static async getVaultStatus(@LogContext args: ValidateVaultFundingArgs): Promise<VaultStatus> {
    const { client, intentSourceAddress, intentHash } = args

    const vault = await client.readContract({
      address: intentSourceAddress,
      abi: IntentSourceAbi,
      functionName: 'getVaultState',
      args: [intentHash],
    })

    return vault.status as VaultStatus
  }

  /**
   * Helper method to get human-readable vault status name
   */
  private static getVaultStatusName(status: VaultStatus): string {
    switch (status) {
      case VaultStatus.EMPTY:
        return 'empty'
      case VaultStatus.PARTIALLY_FUNDED:
        return 'partially_funded'
      case VaultStatus.FULLY_FUNDED:
        return 'fully_funded'
      case VaultStatus.CLAIMED:
        return 'claimed'
      case VaultStatus.Refunded:
        return 'refunded'
      default:
        return 'unknown'
    }
  }
}
