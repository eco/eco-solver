import { Call, Hex } from 'viem';
import { TransactionTargetData, UtilsIntentService } from './utils-intent.service';
import { Solver } from '@libs/solver-config';
import { EcoConfigService } from '@libs/solver-config';
import { FeeService } from '@eco-solver/fee/fee.service';
import { ProofService } from '@eco-solver/prover/proof.service';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { IFulfillService } from '@eco-solver/intent/interfaces/fulfill-service.interface';
import { IntentDataModel } from '@eco-solver/intent/schemas/intent-data.schema';
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
export declare class WalletFulfillService implements IFulfillService {
    private readonly kernelAccountClientService;
    private readonly proofService;
    private readonly feeService;
    private readonly utilsIntentService;
    private readonly ecoConfigService;
    private readonly ecoAnalytics;
    private logger;
    constructor(kernelAccountClientService: KernelAccountClientService, proofService: ProofService, feeService: FeeService, utilsIntentService: UtilsIntentService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    /**
     * Executes the fulfill intent process for an intent. It creates the transaction for fulfillment, and posts it
     * to the chain. It then updates the db model of the intent with the status and receipt.
     *
     * @param {IntentSourceModel} model - The intent model containing details about the intent to be fulfilled.
     * @param {Solver} solver - The solver object used to determine the transaction executor and chain-specific configurations.
     * @return {Promise<void>} Resolves with no value. Throws an error if the intent fulfillment fails.
     */
    fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>;
    /**
     * Checks that the intent is feasible for the fulfillment. This
     * could occur due to changes to the fees/limits of the intent. A failed
     * intent might retry later when its no longer profitable, etc.
     * Throws an error if the intent is not feasible.
     * @param intent the intent to check
     */
    finalFeasibilityCheck(intent: IntentDataModel): Promise<void>;
    /**
     * Checks if the transaction is feasible for an erc20 token transfer.
     *
     * @param tt the transaction target data
     * @param solver the target solver
     * @param target the target ERC20 address
     * @returns
     */
    handleErc20(tt: TransactionTargetData, solver: Solver, target: Hex): Call[];
    /**
     * Generates transactions for specified intent targets by processing the intent source model and solver.
     *
     * @param {IntentSourceModel} model - The intent source model containing call data and routing information.
     * @param {Solver} solver - The solver instance used to resolve transaction target data and relevant configurations.
     * @return {Array} An array of generated transactions based on the intent targets. Returns an empty array if no valid transactions are created.
     */
    private getTransactionsForTargets;
    /**
     * Creates a native transfer call that sends the total native value required by the intent to the inbox contract.
     * Uses the utility function to calculate the total native value from all native calls in the intent.
     *
     * @param solver - The solver configuration containing the inbox address
     * @param nativeCalls - The calls that have native value transfers (from getNativeCalls)
     * @returns A Call object that transfers the total native value to the inbox contract
     */
    private getNativeFulfill;
    /**
     * Returns the fulfill intent data
     * @param inboxAddress
     * @param model
     * @private
     */
    private getFulfillIntentTx;
    /**
     * Generates a transaction to fulfill an intent for a hyperprover based on the configuration.
     *
     * @param {Hex} inboxAddress - The address of the inbox associated with the transaction.
     * @param {Hex} claimant - The address of the claimant requesting fulfillment.
     * @param {IntentSourceModel} model - The model containing the details of the intent to fulfill.
     * @return {Promise<ExecuteSmartWalletArg>} A promise resolving to the transaction arguments needed to fulfill the intent.
     */
    private getFulfillTxForHyperprover;
    /**
     * Constructs a transaction argument for fulfilling a hyper-prover batched intent.
     *
     * @param {Hex} inboxAddress - The address of the inbox contract.
     * @param {Hex} claimant - The address of the entity claiming the intent.
     * @param {IntentSourceModel} model - The intent source model containing the intent, route, and related data.
     * @return {Promise<ExecuteSmartWalletArg>} A promise resolving to an object containing the transaction data for executing the smart wallet.
     */
    private getFulfillTxForHyperproverBatch;
    private getFulfillTxForHyperproverSingle;
    /**
     * Generates a transaction to fulfill an intent for a metalayer prover.
     *
     * @param {Hex} inboxAddress - The address of the inbox associated with the transaction.
     * @param {Hex} claimant - The address of the claimant requesting fulfillment.
     * @param {IntentSourceModel} model - The model containing the details of the intent to fulfill.
     * @return {Promise<ExecuteSmartWalletArg>} A promise resolving to the transaction arguments needed to fulfill the intent.
     */
    private getFulfillTxForMetalayer;
    /**
     * Calculates the fee required for a transaction by calling the prover contract.
     *
     * @param {IntentSourceModel} model - The model containing intent details, including route, hash, and reward information.
     * @param claimant - The claimant address
     * @param proverAddr - The address of the prover contract
     * @param messageData - The message data to send
     * @return {Promise<bigint>} A promise that resolves to the fee amount
     */
    private getProverFee;
}
