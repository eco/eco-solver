import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
import { PermitProcessingParams } from '@eco-solver/permit-processing/interfaces/permit-processing-params.interface';
/**
 * This class returns a transaction for a permit.
 */
export declare class PermitTxBuilder {
    private logger;
    /**
     * This function generates the transaction for the permit. It encodes the function data for the permit function
     * and returns it as an ExecuteSmartWalletArg object.
     *
     * @param params - The parameters for the permit.
     * @returns The transaction object for the permit.
     */
    getPermitTx(params: PermitProcessingParams): ExecuteSmartWalletArg;
    /**
     * This function splits the signature into its components: r, s, and v. It validates the length of the signature
     * and returns an object containing the components.
     *
     * @param sig - The signature to split.
     * @returns An object containing the r, s, and v components of the signature.
     */
    private splitSignature;
}
