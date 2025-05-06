import { addSeconds, compareAsc } from 'date-fns'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { entries } from 'lodash'
import { getAddress, Hex } from 'viem'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { IProverAbi } from '@eco-foundation/routes-ts'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { ProofCall, ProofType } from '@/contracts'

/**
 * Service class for getting information about the provers and their configurations.
 */
@Injectable()
export class ProofService implements OnModuleInit {
  private logger = new Logger(ProofService.name)

  /**
   * Variable storing the proof type for each prover address. Used to determine
   * what function to call on the Inbox contract
   */
  private proofContracts: Record<Hex, ProofType> = {}

  constructor(
    private readonly publicClient: MultichainPublicClientService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    await this.loadProofTypes()
  }

  /**
   * Returns the proof type for a given prover address
   *
   * @param proverAddress
   * @returns the proof type, defaults to {@link PROOF_STORAGE}
   */
  getProofType(proverAddress: Hex): ProofType {
    return this.proofContracts[proverAddress]
  }

  /**
   * Checks if the prover is a hyperlane prover
   * @param proverAddress the prover address
   * @returns
   */
  isHyperlaneProver(proverAddress: Hex): boolean {
    return this.getProofType(proverAddress).isHyperlane()
  }

  /**
   * Checks if the prover is a metalayer prover
   * @param proverAddress the prover address
   * @returns
   */
  isMetalayerProver(proverAddress: Hex): boolean {
    return this.getProofType(proverAddress).isMetalayer()
  }

  /**
   * Returns all the prover addresses for a given proof type
   * @param proofType the proof type
   * @returns
   */
  getProvers(proofType: ProofType): Hex[] {
    return entries(this.proofContracts)
      .filter(([, type]) => type === proofType)
      .map(([address]) => getAddress(address))
  }

  /**
   * Returns the prover type for a given prover address
   * @param prover the prover address
   * @returns
   */
  getProverType(prover: Hex): ProofType {
    return this.proofContracts[prover]
  }

  /**
   * Loads the proof types for each prover address into memory.
   * Assume all provers must have the same proof type if their
   * hex address is the same.
   */
  private async loadProofTypes() {
    const proofPromises = this.ecoConfigService.getIntentSources().map(async (source) => {
      return await this.getProofTypes(source.chainID, source.provers)
    })

    // get the proof types for each prover address from on chain
    const proofs = await Promise.all(proofPromises)

    // reduce the array of proof objects into a single object, removing duplicates
    proofs.reduce((acc, proof) => {
      entries(proof).forEach(([proverAddress, proofType]) => {
        acc[proverAddress] = proofType
      })
      return acc
    }, this.proofContracts)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `loadProofTypes loaded all the proof types`,
        properties: {
          proofs: this.proofContracts,
        },
      }),
    )
  }

  /**
   * Fetches all the proof types for the provers on a given chain using {@link ViemMultichainClientService#multicall}
   *
   * @param chainID the chain id
   * @param provers the prover addresses
   * @returns
   */
  private async getProofTypes(chainID: number, provers: Hex[]): Promise<Record<Hex, ProofType>> {
    const client = await this.publicClient.getClient(Number(chainID))
    const proofCalls: ProofCall[] = provers.map((proverAddress) => {
      return {
        address: proverAddress,
        abi: IProverAbi,
        functionName: 'getProofType',
      }
    })

    const proofTypeResults = await client.multicall({ contracts: proofCalls })

    const proofObj: Record<Hex, ProofType> = {}

    for (const proverIndex in provers) {
      const proverAddr = provers[proverIndex]
      const { result: proofType } = proofTypeResults[proverIndex]
      proofObj[proverAddr] = this.getProofTypeFromString(proofType!)
    }

    return proofObj
  }

  /**
   * Check to see if the expiration of an intent is after the minimum proof time from now.
   *
   * @param prover the address of the prover
   * @param expirationDate the expiration date
   * @returns true if the intent can be proven before the minimum proof time, false otherwise
   */
  isIntentExpirationWithinProofMinimumDate(prover: Hex, expirationDate: Date): boolean {
    return compareAsc(expirationDate, this.getProofMinimumDate(this.proofContracts[prover])) == 1
  }

  /**
   * Gets the minimum date that a proof can be generated for a given chain id.
   * @param prover
   * @returns
   */
  getProofMinimumDate(prover: ProofType): Date {
    return addSeconds(new Date(), this.getProofMinimumDurationSeconds(prover))
  }

  /**
   * Get ProofType from string
   * @param proof
   * @private
   */
  private getProofTypeFromString(proof: string): ProofType {
    return ProofType.fromProviderValue(proof)
  }

  /**
   * The minimum duration that a proof can be generated for a given prover
   *
   * @param prover the address of the prover
   * @returns
   */
  private getProofMinimumDurationSeconds(prover: ProofType): number {
    const proofs = this.ecoConfigService.getIntentConfigs().proofs
    switch (true) {
      case prover.isHyperlane():
        return proofs.hyperlane_duration_seconds
      case prover.isMetalayer():
        return proofs.metalayer_duration_seconds
      default:
        throw EcoError.ProverNotSupported(prover)
    }
  }
}
