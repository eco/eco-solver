@Injectable()
export class PermitValidationService {
  private logger = new EcoLogger(PermitValidationService.name)

  constructor(
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {}

  private async getClient(chainID: number): Promise<PublicClient> {
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainID)
    return publicClient.extend(publicActions)
  }

  async validatePermits(validationArgs: PermitValidationArgs): Promise<EcoResponse<void>> {
    const { chainId, permits, permit2, reward, spender, owner, expectedVault } = validationArgs

    // 1. Validate vault
    if (expectedVault) {
      const { error } = this.isValidVaultAddress(spender, expectedVault)

      if (error) {
        return { error }
      }
    }

    const client = await this.getClient(chainId)
    let permitSimulationParams: PermitParams[] = []
    let permit2SimulationParams: Permit2Params[] = []

    // 2. Verify permits
    if (_.size(permits) > 0) {
      permitSimulationParams = this.getPermitSimulationParams(permits!, owner, reward, spender)

      const { error: permitValidationError } = await PermitValidator.validatePermits(
        client,
        permitSimulationParams,
      )

      if (permitValidationError) {
        return { error: permitValidationError }
      }
    }

    if (permit2) {
      permit2SimulationParams = this.getPermit2SimulationParams(permit2, owner, reward)

      const { error: permit2ValidationError } = await Permit2Validator.validatePermits(
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

  async batchSimulatePermits(
    client: PublicClient,
    permits: PermitParams[],
    permit2s: Permit2Params[],
  ): Promise<EcoResponse<void>> {
    const permitCalls = PermitValidator.getPermitCalls(permits)
    const permit2Calls = Permit2Validator.getPermitCalls(permit2s)
    const calls = [...permitCalls, ...permit2Calls]

    try {
      await Promise.all(calls.map((call) => client.simulateContract(call)))
      return {}
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `batchSimulatePermits: error simulating permits: ${ex.message}`,
        }),
      )

      return { error: EcoError.PermitSimulationsFailed }
    }
  }

  async validateVaultFunding(args: ValidateVaultFundingArgs): Promise<EcoResponse<void>> {
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

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `✅ Vault funded and valid for intent ${intentHash}`,
      }),
    )

    return {}
  }

  private getPermitSimulationParams(
    permits: PermitDTO[],
    owner: Hex,
    reward: QuoteRewardDataDTO,
    vaultAddress: Hex,
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
        const {
          data: { signature, deadline },
        } = tokenPermit

        permitSimulations.push({
          tokenAddress: token.token,
          signature: signature,
          deadline,
          owner,
          spender: vaultAddress,
          value: BigInt(token.amount),
        })
      }
    }

    return permitSimulations
  }

  private getPermit2SimulationParams(
    permit: Permit2DTO,
    owner: Hex,
    reward: QuoteRewardDataDTO,
  ): Permit2Params[] {
    reward = QuoteRewardDataDTO.fromJSON(reward)
    const { permitData } = permit
    const { singlePermitData, batchPermitData } = permitData

    if (!singlePermitData && !batchPermitData) {
      return []
    }

    const spender = permitData.getSpender()
    const sigDeadline = permitData.getSigDeadline()
    const details = singlePermitData
      ? [singlePermitData.typedData.details]
      : batchPermitData!.typedData.details

    const permitSimulation: Permit2Params = {
      permit2Address: permit.permitContract,
      owner,
      // owner: funder,
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

    return [permitSimulation]
  }

  private isValidVaultAddress(spender: Address, expectedVault: Address): EcoResponse<void> {
    try {
      return isAddressEqual(spender, expectedVault) ? {} : { error: EcoError.InvalidVaultAddress }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `isAddressEqual: error comparing addresses: ${ex.message}`,
        }),
      )

      return { error: EcoError.InvalidVaultAddress }
    }
  }
}
