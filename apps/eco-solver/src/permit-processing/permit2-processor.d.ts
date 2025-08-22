import { EcoResponse } from '@eco-solver/common/eco-response';
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Permit2DTO } from '@eco-solver/quote/dto/permit2/permit2.dto';
import { TransactionReceipt } from 'viem';
import { Hex } from 'viem';
/**
 * This class processes the permit2 transaction. It generates the transaction for the permits and executes it.
 */
export declare class Permit2Processor implements OnModuleInit {
    private readonly moduleRef;
    private logger;
    private kernelAccountClientService;
    private permit2TxBuilder;
    constructor(moduleRef: ModuleRef);
    onModuleInit(): void;
    /**
     * This function generates the transaction for the permit2. It encodes the function data for the permit2 function
     * and returns it as an ExecuteSmartWalletArg[] object.
     *
     * @param funder - The funder address.
     * @param permit - The parameters for the permit processing.
     * @returns The transaction objects for the permits.
     */
    generateTxs(funder: Hex, permit: Permit2DTO): EcoResponse<ExecuteSmartWalletArg[]>;
    executeTxs(funder: Hex, chainID: number, permit: Permit2DTO): Promise<EcoResponse<TransactionReceipt>>;
}
