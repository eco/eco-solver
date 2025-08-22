import { EcoResponse } from '@eco-solver/common/eco-response';
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PermitProcessingParams } from '@eco-solver/permit-processing/interfaces/permit-processing-params.interface';
import { TransactionReceipt } from 'viem';
/**
 * This class processes the permit transactions. It generates the transactions for the permits and executes them.
 * It also validates the parameters for the permit processing.
 */
export declare class PermitProcessor implements OnModuleInit {
    private readonly moduleRef;
    private logger;
    private kernelAccountClientService;
    private permitTxBuilder;
    constructor(moduleRef: ModuleRef);
    onModuleInit(): void;
    /**
     * This function generates the transaction for the permits. It encodes the function data for the permit function
     * and returns it as an ExecuteSmartWalletArg[] object.
     *
     * @param params - The parameters for the permit processing.
     * @returns The transaction objects for the permits.
     */
    generateTxs(...params: PermitProcessingParams[]): EcoResponse<ExecuteSmartWalletArg[]>;
    /**
     * This function executes the transactions for the permits. It generates the transactions and posts them to the chain.
     * It then waits for the transaction receipt and returns it.
     *
     * @param params - The parameters for the permit processing.
     * @returns The transaction receipt for the permits.
     */
    executeTxs(...params: PermitProcessingParams[]): Promise<EcoResponse<TransactionReceipt>>;
    /**
     * This function validates the parameters for the permit processing. It checks that at least one permit was passed
     * and all permits are for the same chain.
     *
     * @param params - The parameters for the permit processing.
     * @returns An EcoResponse object containing any errors or an empty object if valid.
     */
    private validateParams;
}
