import { Address, GetCodeReturnType, Hex, keccak256 } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PublicClient } from 'viem'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

type KnownProver = {
  address: Address

  // For future improvement: The hash of the deployed prover's bytecode, used to verify the contract's integrity.
  // This can be used to ensure that the contract has not been tampered with.
  bytecodeHash?: Hex
}

@Injectable()
export class ProverValidationService implements OnModuleInit {
  private logger = new EcoLogger(ProverValidationService.name)
  private readonly clientsByChainID = new Map<number, PublicClient>()
  private readonly knownProverHashes = new Map<number, Map<Address, Hex>>() // chainId -> (lowercased address -> hash)
  private readonly proversByChainID = new Map<number, KnownProver[]>()

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {}

  onModuleInit() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${ProverValidationService.name}.onModuleInit()`,
      }),
    )

    this.setupProverValidationData()
  }

  async validateProver(chainID: number, proverAddress: Address): Promise<EcoResponse<void>> {
    const lowerAddr = proverAddress.toLowerCase() as Address
    const knownHashes = this.knownProverHashes.get(chainID)

    if (!knownHashes || !knownHashes.has(lowerAddr)) {
      return { error: EcoError.ProverNotRegistered(chainID, proverAddress) }
    }

    let actualHash = knownHashes.get(lowerAddr)

    if (!actualHash || actualHash === '0x') {
      const { response: bytecode, error } = await this.checkProverContractDeployed(
        chainID,
        proverAddress,
      )

      if (error) {
        return { error }
      }

      // TODO: Replace dynamic hash inference with known hashes via config/deployment
      actualHash = keccak256(bytecode!)
      knownHashes.set(lowerAddr, actualHash)
    }

    const expectedHash = knownHashes.get(lowerAddr)

    if (actualHash !== expectedHash) {
      return { error: EcoError.ProverBytecodeMismatch(chainID, proverAddress) }
    }

    return {}
  }

  private setupProverValidationData() {
    this.setupProversByChainID()

    for (const [chainID, provers] of this.proversByChainID.entries()) {
      const proverMap = new Map<Address, Hex>()

      for (const { address, bytecodeHash } of provers) {
        proverMap.set(address, bytecodeHash || ('0x' as Hex))
      }

      this.knownProverHashes.set(chainID, proverMap)
    }
  }

  private setupProversByChainID() {
    const intentSources = this.ecoConfigService.getIntentSources()

    for (const intent of intentSources) {
      const { chainID, provers } = intent

      const knownProvers = provers.map((prover) => ({ address: prover.toLowerCase() as Address }))

      const current = this.proversByChainID.get(chainID) || []
      current.push(...knownProvers)
      this.proversByChainID.set(chainID, current)
    }

    // Remove duplicates by address
    for (const [chainID, provers] of this.proversByChainID.entries()) {
      this.proversByChainID.set(
        chainID,
        Array.from(new Map(provers.map((p) => [p.address, p])).values()),
      )
    }
  }

  private async checkProverContractDeployed(
    chainID: number,
    address: Address,
  ): Promise<EcoResponse<GetCodeReturnType>> {
    const { response: publicClient, error } = await this.getPublicClient(chainID)

    if (error) {
      return { error }
    }

    const bytecode = await publicClient!.getCode({ address })

    if (!bytecode || bytecode === '0x') {
      return { error: EcoError.NoContractDeployed(chainID, address) }
    }

    return { response: bytecode }
  }

  private async getPublicClient(chainID: number): Promise<EcoResponse<PublicClient>> {
    try {
      let client = this.clientsByChainID.get(chainID)

      if (!client) {
        client = await this.walletClientDefaultSignerService.getPublicClient(chainID)
        this.clientsByChainID.set(chainID, client)
      }

      return { response: client }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to get public client for chain ID ${chainID}`,
          properties: {
            error: ex.message,
          },
        }),
      )

      return { error: EcoError.CreatePublicClientError(chainID) }
    }
  }
}
