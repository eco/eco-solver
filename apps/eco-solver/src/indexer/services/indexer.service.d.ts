import { Hex } from 'viem';
import { EcoConfigService } from '@libs/solver-config';
import { BatchWithdraws } from '@eco-solver/indexer/interfaces/batch-withdraws.interface';
import { SendBatchData } from '@eco-solver/indexer/interfaces/send-batch-data.interface';
export declare class IndexerService {
    private readonly ecoConfigService;
    private logger;
    private config;
    constructor(ecoConfigService: EcoConfigService);
    getNextBatchWithdrawals(intentSourceAddr?: Hex): Promise<BatchWithdraws[]>;
    getNextSendBatch(intentSourceAddr?: Hex): Promise<SendBatchData[]>;
    private fetch;
    private isGaslessIntent;
}
