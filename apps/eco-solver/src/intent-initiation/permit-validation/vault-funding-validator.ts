import { EcoError } from '../../common/errors/eco-error'
import { EcoLogger } from '../../common/logging/eco-logger'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { EcoResponse } from '../../common/eco-response'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { ValidateVaultFundingArgs } from './interfaces/validate-vault-funding-args.interface'

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
  private static logger = new EcoLogger(VaultFundingValidator.name)

  static async validateVaultFunding(args: ValidateVaultFundingArgs): Promise<EcoResponse<void>> {
    const { client, intentSourceAddress, intentHash, preventRedundantFunding } = args

    const vaultStatus = await this.getVaultStatus({
      client,
      intentSourceAddress,
      intentHash,
    })

    if (vaultStatus === VaultStatus.CLAIMED) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `❌ Vault for intent ${intentHash} has already been claimed`,
        }),
      )

      return { error: EcoError.VaultAlreadyClaimed }
    }

    if (vaultStatus === VaultStatus.FULLY_FUNDED) {
      if (preventRedundantFunding) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `❌ Vault for intent ${intentHash} is already fully funded`,
          }),
        )

        return { error: EcoError.VaultAlreadyFunded }
      }

      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `⚠️ Vault for intent ${intentHash} is already funded`,
        }),
      )

      return {}
    }

    if (vaultStatus < VaultStatus.FULLY_FUNDED) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `❌ Vault for intent ${intentHash} is not yet fully funded`,
        }),
      )

      return { error: EcoError.VaultNotFullyFundedAfterPermit }
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `✅ Vault validated and funded for intent ${intentHash}`,
      }),
    )

    return {}
  }

  static async isVaultFunded(args: ValidateVaultFundingArgs): Promise<boolean> {
    const status = await this.getVaultStatus(args)
    return status >= VaultStatus.FULLY_FUNDED
  }

  static isVaultStale(status: VaultStatus): boolean {
    return status === VaultStatus.CLAIMED || status === VaultStatus.FULLY_FUNDED
  }

  static async getVaultStatus(args: ValidateVaultFundingArgs): Promise<VaultStatus> {
    const { client, intentSourceAddress, intentHash } = args

    const vault = await client.readContract({
      address: intentSourceAddress,
      abi: IntentSourceAbi,
      functionName: 'getVaultState',
      args: [intentHash],
    })

    return vault.status as VaultStatus
  }
}
