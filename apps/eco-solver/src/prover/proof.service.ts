import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as _ from 'lodash'
import { getAddress } from 'viem'
import { Hex } from 'viem'
import { IProverAbi } from '@eco-foundation/routes-ts'
import { addSeconds, compareAsc } from 'date-fns'
import { ProofCall, ProofType } from '../contracts'
import { EcoError } from '../common/errors/eco-error'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { EcoConfigService } from '@libs/solver-config'
import { MultichainPublicClientService } from '../transaction/multichain-public-client.service'

interface ProverMetadata {
  address: Hex
  type: ProofType
  chainID: number
}

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
  private provers: ProverMetadata[] = []

  constructor(
    private readonly publicClient: MultichainPublicClientService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    await this.loadProofTypes()
  }

  /**
   * Checks if the prover is a hyperlane prover
   * @param chainID
   * @param proverAddress the prover address
   * @returns
   */
  isHyperlaneProver(chainID: number, proverAddress: Hex): boolean {
    return Boolean(this.getProverType(chainID, proverAddress)?.isHyperlane())
  }

  /**
   * Checks if the prover is a metalayer prover
   * @param chainID
   * @param proverAddress the prover address
   * @returns
   */
  isMetalayerProver(chainID: number, proverAddress: Hex): boolean {
    return Boolean(this.getProverType(chainID, proverAddress)?.isMetalayer())
  }

  /**
   * Returns all the prover addresses for a given proof type
   * @param proofType the proof type
   * @returns
   */
  getProvers(proofType: ProofType): Hex[] {
    const proverAddresses = this.provers
      .filter((prover) => prover.type === proofType)
      .map((prover) => getAddress(prover.address))

    return _.uniq(proverAddresses)
  }

  /**
   * Returns the prover type for a given prover address
   * @param chainID
   * @param proverAddr the prover address
   * @returns
   */
  getProverType(chainID: number, proverAddr: Hex): ProofType | undefined {
    return this.provers.find(
      (prover) => prover.chainID === chainID && prover.address === proverAddr,
    )?.type
  }

  /**
   * Check to see if the expiration of an intent is after the minimum proof time from now.
   *
   * @param chainID
   * @param prover the address of the prover
   * @param expirationDate the expiration date
   * @returns true if the intent can be proven before the minimum proof time, false otherwise
   */
  isIntentExpirationWithinProofMinimumDate(
    chainID: number,
    prover: Hex,
    expirationDate: Date,
  ): boolean {
    const proofType = this.getProverType(chainID, prover)
    if (!proofType) {
      return false
    }
    return compareAsc(expirationDate, this.getProofMinimumDate(proofType)) === 1
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
   * Loads the proof types for each prover address into memory.
   * Assume all provers must have the same proof type if their
   * hex address is the same.
   */
  private async loadProofTypes() {
    const proofPromises = this.ecoConfigService
      .getIntentSources()
      .map((source) => this.getProofTypes(source.chainID, source.provers as `0x${string}`[]))

    // get the proof types for each prover address from on chain
    const proofs = await Promise.all(proofPromises)

    this.provers = proofs.flat()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `loadProofTypes loaded all the proof types`,
        properties: {
          proofs: this.provers,
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
  private async getProofTypes(chainID: number, provers: Hex[]): Promise<ProverMetadata[]> {
    const client = await this.publicClient.getClient(Number(chainID))
    const proofCalls: ProofCall[] = provers.map((proverAddress) => ({
      address: proverAddress,
      abi: IProverAbi,
      functionName: 'getProofType',
    }))

    const proofTypeResults = await client.multicall({ contracts: proofCalls })

    const proofs: ProverMetadata[] = []

    for (const proverIndex in provers) {
      const proverAddr = provers[proverIndex]
      const { result: proofType, error } = proofTypeResults[proverIndex]

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `getProofTypes: error fetching proof type`,
            properties: {
              chainID,
              proverAddr,
              error: error.message,
            },
          }),
        )
        continue
      }

      if (proofType) {
        proofs.push({
          chainID,
          address: proverAddr,
          type: this.getProofTypeFromString(proofType),
        })
      }
    }

    return proofs
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
