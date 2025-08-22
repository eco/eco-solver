import { Hex } from 'viem';
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
import { Permit2DTO } from '@eco-solver/quote/dto/permit2/permit2.dto';
/**
 * This class returns a transaction for a permit2.
 */
export declare class Permit2TxBuilder {
    private logger;
    /**
     * This function generates the transaction for the permit2. It encodes the function data for the permit2 function
     * and returns it as an ExecuteSmartWalletArg object.
     *
     * @param permit - The parameters for the permit processing.
     * @returns The transaction object for the permit.
     */
    getPermit2Tx(funder: Hex, permit: Permit2DTO): ExecuteSmartWalletArg;
    /**
     * This function encodes the function data for the permit2 function. It uses the ABI and function name to encode
     * the arguments and returns the encoded data.
     *
     * @param owner - The address of the owner.
     * @param spender - The address of the spender.
     * @param sigDeadline - The signature deadline.
     * @param signature - The signature.
     * @param details - The details for the permit processing.
     * @returns The encoded function data.
     */
    private encodeFunctionData;
    /**
     * This function builds the permit argument for a single permit. It takes the details and returns an object
     * containing the permitted token, amount, nonce, and deadline.
     *
     * @param spender - The address of the spender.
     * @param sigDeadline - The signature deadline.
     * @param details - The details for the permit processing.
     * @returns The permit argument for a single permit.
     */
    private buildPermitSingleArg;
    /**
     * This function builds the permit argument for a batch of permits. It takes the details and returns an object
     * containing the permitted tokens, amounts, nonce, and deadline.
     *
     * @param spender - The address of the spender.
     * @param sigDeadline - The signature deadline.
     * @param details - The details for the permit processing.
     * @returns The permit argument for a batch of permits.
     */
    private buildPermitBatchArg;
}
