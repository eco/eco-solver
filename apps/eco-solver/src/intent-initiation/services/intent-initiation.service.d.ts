import { EcoConfigService } from '@libs/solver-config';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { EstimatedGasDataForIntentInitiation } from '@eco-solver/intent-initiation/interfaces/estimated-gas-data-for-intent-initiation.interface';
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
import { GaslessIntentRequestDTO } from '@eco-solver/quote/dto/gasless-intent-request.dto';
import { GaslessIntentResponseDTO } from '@eco-solver/intent-initiation/dtos/gasless-intent-response.dto';
import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PermitValidationService } from '@eco-solver/intent-initiation/permit-validation/permit-validation.service';
export declare class IntentInitiationService implements OnModuleInit {
    private readonly permitValidationService;
    private readonly ecoConfigService;
    private readonly moduleRef;
    private logger;
    private quoteRepository;
    private permitProcessor;
    private permit2Processor;
    private kernelAccountClientService;
    private createIntentService;
    private gaslessIntentdAppIDs;
    constructor(permitValidationService: PermitValidationService, ecoConfigService: EcoConfigService, moduleRef: ModuleRef);
    onModuleInit(): void;
    /**
     * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
     * @param gaslessIntentRequestDTO
     * @returns
     */
    initiateGaslessIntent(gaslessIntentRequestDTO: GaslessIntentRequestDTO): Promise<EcoResponse<GaslessIntentResponseDTO>>;
    private checkGaslessIntentSupported;
    /**
     * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
     * @param gaslessIntentRequestDTO
     * @returns
     */
    _initiateGaslessIntent(gaslessIntentRequestDTO: GaslessIntentRequestDTO): Promise<EcoResponse<GaslessIntentResponseDTO>>;
    calculateGasQuoteForIntent(gaslessIntentRequest: GaslessIntentRequestDTO, bufferPercent?: number): Promise<EcoResponse<EstimatedGasDataForIntentInitiation>>;
    getGasPrice(chainID: number, defaultValue: bigint): Promise<bigint>;
    /**
     * This function is used to generate the transactions for the gasless intent. It generates the permit transactions and fund transaction.
     * @param gaslessIntentRequestDTO
     * @returns
     */
    generateGaslessIntentTransactions(gaslessIntentRequestDTO: GaslessIntentRequestDTO): Promise<EcoResponse<ExecuteSmartWalletArg[]>>;
    /**
     * This function is used to get the set of transactions for the gasless intent.
     * These comprise the fundFor tx as well as the permit/permit2 txs.
     * @param gaslessIntentRequestDTO
     * @param salt
     * @returns
     */
    private getIntentFundForTx;
    private generatePermitTxs;
    private getPermitTxs;
    private getPermit2Txs;
}
