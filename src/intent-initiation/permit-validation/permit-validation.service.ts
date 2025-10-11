import { EcoError } from '@/common/errors/eco-error'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoResponse } from '@/common/eco-response'
import { Injectable } from '@nestjs/common'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2Params } from '@/intent-initiation/permit-validation/interfaces/permit2-params.interface'
import { Permit2Validator } from '@/intent-initiation/permit-validation/permit2-validator'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { PermitParams } from '@/intent-initiation/permit-validation/interfaces/permit-params.interface'
import { PermitValidationArgs } from '@/intent-initiation/permit-validation/interfaces/permit-validation-args.interface'
import { PermitValidator } from '@/intent-initiation/permit-validation/permit-validator'
import { PublicClient, publicActions, isAddressEqual, Address } from 'viem'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { ValidateVaultFundingArgs } from '@/intent-initiation/permit-validation/interfaces/validate-vault-funding-args.interface'
import { VaultFundingValidator } from '@/intent-initiation/permit-validation/vault-funding-validator'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import * as _ from 'lodash'

@Injectable()
export class PermitValidationService {
  private logger = new IntentOperationLogger('PermitValidationService')
  private permit2Validator = new Permit2Validator()

  constructor(
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {}

  private async getClient(chainID: number): Promise<PublicClient> {
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainID)
    return publicClient.extend(publicActions)
  }

  @LogOperation('permit_validation', IntentOperationLogger)
  async validatePermits(
    @LogContext validationArgs: PermitValidationArgs,
  ): Promise<EcoResponse<void>> {
    const { chainId, permits, permit2s, reward } = validationArgs

    // 1. Validate vault
    // if (expectedVault) {
    //   const { error } = this.isValidVaultAddress(spender, expectedVault)

    //   if (error) {
    //     return { error }
    //   }
    // }

    const client = await this.getClient(chainId)
    let permitSimulationParams: PermitParams[] = []
    let permit2SimulationParams: Permit2Params[] = []

    // 2. Verify permits
    if (_.size(permits) > 0) {
      permitSimulationParams = this.getPermitSimulationParams(permits!, reward)

      const { error: permitValidationError } = await PermitValidator.validatePermits(
        client,
        permitSimulationParams,
      )

      if (permitValidationError) {
        return { error: permitValidationError }
      }
    }

    if (_.size(permit2s) > 0) {
      permit2SimulationParams = this.getPermit2SimulationParams(permit2s!, reward)

      const { error: permit2ValidationError } = await this.permit2Validator.validatePermits(
        client,
        chainId,
        permit2SimulationParams,
      )

      if (permit2ValidationError) {
        return { error: permit2ValidationError }
      }
    }

    // 3. Simulate permit calls to ensure no revert
    return await this.batchSimulatePermits(client, permitSimulationParams, permit2SimulationParams)

    // 4. Verify vault is funded
    // const chainConfig = getChainConfig(chainId)
    // const intentSourceAddress = chainConfig.IntentSource

    // return this.validateVaultFunding({
    //   client,
    //   intentSourceAddress,
    //   intentHash,
    //   preventRedundantFunding: true,
    // })
  }

  @LogOperation('permit_batch_simulation', IntentOperationLogger)
  async batchSimulatePermits(
    @LogContext client: PublicClient,
    @LogContext permits: PermitParams[],
    @LogContext permit2s: Permit2Params[],
  ): Promise<EcoResponse<void>> {
    const permitCalls = PermitValidator.getPermitCalls(permits)
    const permit2Calls = this.permit2Validator.getPermitCalls(permit2s)
    const calls = [...permitCalls, ...permit2Calls]

    try {
      await Promise.all(calls.map((call) => client.simulateContract(call)))
      return {}
    } catch (ex) {
      return { error: EcoError.PermitSimulationsFailed }
    }
  }

  @LogOperation('vault_funding_validation', IntentOperationLogger)
  async validateVaultFunding(
    @LogContext args: ValidateVaultFundingArgs,
  ): Promise<EcoResponse<void>> {
    const { client, intentSourceAddress, intentHash } = args

    const { error: vaultFundingError } = await VaultFundingValidator.validateVaultFunding({
      client,
      intentSourceAddress,
      intentHash,
      preventRedundantFunding: true,
    })

    if (vaultFundingError) {
      return { error: vaultFundingError }
    }

    return {}
  }

  private getPermitSimulationParams(
    permits: PermitDTO[],
    reward: QuoteRewardDataDTO,
  ): PermitParams[] {
    const permitMap: Record<string, PermitDTO> = {}

    for (const permit of permits) {
      permitMap[permit.token.toLowerCase()] = permit
    }

    // Iterate over the reward tokens and call permit on that token contract if there exists a permit with a matching token address
    const { tokens } = reward
    const permitSimulations: PermitParams[] = []

    for (const token of tokens) {
      const tokenPermit = permitMap[token.token.toLowerCase()]

      if (tokenPermit) {
        const { signature, deadline, spender, funder } = tokenPermit

        permitSimulations.push({
          tokenAddress: token.token,
          signature: signature,
          deadline,
          owner: funder,
          spender,
          value: BigInt(token.amount),
        })
      }
    }

    return permitSimulations
  }

  private getPermit2SimulationParams(
    permit2s: Permit2DTO[],
    reward: QuoteRewardDataDTO,
  ): Permit2Params[] {
    const simulationParams: Permit2Params[] = []

    for (const permit of permit2s) {
      const permitSimulation = this.getPermit2SimulationParamsForPermit(permit, reward)

      if (permitSimulation.details.length > 0) {
        simulationParams.push(permitSimulation)
      }
    }

    return simulationParams
  }

  private getPermit2SimulationParamsForPermit(
    permit: Permit2DTO,
    reward: QuoteRewardDataDTO,
  ): Permit2Params {
    reward = QuoteRewardDataDTO.fromJSON(reward)
    const { details, spender, funder, sigDeadline } = permit

    const permitSimulation: Permit2Params = {
      permit2Address: permit.permitContract,
      owner: funder,
      spender,
      sigDeadline,
      details: [],
      signature: permit.signature,
    }

    for (const detailsEntry of details) {
      if (reward.hasToken!(detailsEntry.token)) {
        permitSimulation.details.push({
          token: detailsEntry.token,
          amount: BigInt(detailsEntry.amount),
          expiration: BigInt(detailsEntry.expiration),
          nonce: BigInt(detailsEntry.nonce),
        })
      }
    }

    return permitSimulation
  }

  private isValidVaultAddress(spender: Address, expectedVault: Address): EcoResponse<void> {
    try {
      return isAddressEqual(spender, expectedVault) ? {} : { error: EcoError.InvalidVaultAddress }
    } catch (ex) {
      // Log vault address validation error using business event method
      this.logger.logPermitValidationResult('vault-validation', 'vault_funding', false, ex)

      return { error: EcoError.InvalidVaultAddress }
    }
  }
}
