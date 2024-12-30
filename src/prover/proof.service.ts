import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { addSeconds, compareAsc } from 'date-fns'
import { MultichainPublicClientService } from '../transaction/multichain-public-client.service'
import { Hex } from 'viem'
import {
  PROOF_HYPERLANE,
  PROOF_STORAGE,
  ProofCall,
  ProofType,
  ProverInterfaceAbi,
} from '../contracts'
import { entries } from 'lodash'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'

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

  // set the minimum duration for a proof to be valid as a constant to 14 days
  // TODO: update prover interace contract to return the duration here
  public static readonly PROOF_STORAGE_MINIMUM_DURATION_SECONDS = 60 * 60 * 24 * 14

  // the minimum duration for a hyperprover to be valid, 1 hour
  public static readonly PROOF_HYPERPROVER_MINIMUM_DURATION_SECONDS = 60 * 15
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
    return this.getProofType(proverAddress) === PROOF_HYPERLANE
  }

  /**
   * Checks if the prover is a storage prover
   * @param proverAddress the prover address
   * @returns
   */
  isStorageProver(proverAddress: Hex): boolean {
    return this.getProofType(proverAddress) === PROOF_STORAGE
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
        abi: ProverInterfaceAbi,
        functionName: 'getProofType',
      }
    })

    const proofs = (await client.multicall({
      contracts: proofCalls.flat(),
    })) as any
    let proof: ProofType = 0,
      i = 0
    const proofObj: Record<Hex, ProofType> = {}
    while (proofs.length > 0 && ([{ result: proof }] = [proofs.shift()])) {
      proofObj[provers[i]] = proof
      i++
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
    return compareAsc(expirationDate, this.getProofMinimumDate(prover)) == 1
  }

  /**
   * Gets the minimum date that a proof can be generated for a given chain id.
   * @param chainID  the chain id
   * @returns
   */
  getProofMinimumDate(prover: Hex): Date {
    return addSeconds(new Date(), this.getProofMinimumDurationSeconds(prover))
  }

  /**
   * The minimum duration that a proof can be generated for a given prover
   *
   * @param prover the address of the prover
   * @returns
   */
  private getProofMinimumDurationSeconds(prover: Hex): number {
    return this.isHyperlaneProver(prover)
      ? ProofService.PROOF_HYPERPROVER_MINIMUM_DURATION_SECONDS
      : ProofService.PROOF_STORAGE_MINIMUM_DURATION_SECONDS
  }
}
