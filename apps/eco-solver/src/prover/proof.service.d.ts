import { OnModuleInit } from '@nestjs/common';
import { Hex } from 'viem';
import { ProofType } from '@eco-solver/contracts';
import { EcoConfigService } from '@libs/solver-config';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
/**
 * Service class for getting information about the provers and their configurations.
 */
export declare class ProofService implements OnModuleInit {
    private readonly publicClient;
    private readonly ecoConfigService;
    private logger;
    /**
     * Variable storing the proof type for each prover address. Used to determine
     * what function to call on the Inbox contract
     */
    private provers;
    constructor(publicClient: MultichainPublicClientService, ecoConfigService: EcoConfigService);
    onModuleInit(): Promise<void>;
    /**
     * Checks if the prover is a hyperlane prover
     * @param chainID
     * @param proverAddress the prover address
     * @returns
     */
    isHyperlaneProver(chainID: number, proverAddress: Hex): boolean;
    /**
     * Checks if the prover is a metalayer prover
     * @param chainID
     * @param proverAddress the prover address
     * @returns
     */
    isMetalayerProver(chainID: number, proverAddress: Hex): boolean;
    /**
     * Returns all the prover addresses for a given proof type
     * @param proofType the proof type
     * @returns
     */
    getProvers(proofType: ProofType): Hex[];
    /**
     * Returns the prover type for a given prover address
     * @param chainID
     * @param proverAddr the prover address
     * @returns
     */
    getProverType(chainID: number, proverAddr: Hex): ProofType | undefined;
    /**
     * Check to see if the expiration of an intent is after the minimum proof time from now.
     *
     * @param chainID
     * @param prover the address of the prover
     * @param expirationDate the expiration date
     * @returns true if the intent can be proven before the minimum proof time, false otherwise
     */
    isIntentExpirationWithinProofMinimumDate(chainID: number, prover: Hex, expirationDate: Date): boolean;
    /**
     * Gets the minimum date that a proof can be generated for a given chain id.
     * @param prover
     * @returns
     */
    getProofMinimumDate(prover: ProofType): Date;
    /**
     * Loads the proof types for each prover address into memory.
     * Assume all provers must have the same proof type if their
     * hex address is the same.
     */
    private loadProofTypes;
    /**
     * Fetches all the proof types for the provers on a given chain using {@link ViemMultichainClientService#multicall}
     *
     * @param chainID the chain id
     * @param provers the prover addresses
     * @returns
     */
    private getProofTypes;
    /**
     * Get ProofType from string
     * @param proof
     * @private
     */
    private getProofTypeFromString;
    /**
     * The minimum duration that a proof can be generated for a given prover
     *
     * @param prover the address of the prover
     * @returns
     */
    private getProofMinimumDurationSeconds;
}
