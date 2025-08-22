import { OnApplicationBootstrap } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { IndexerService } from '@eco-solver/indexer/services/indexer.service';
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service';
import { ExecuteWithdrawsJobData } from '@eco-solver/intent-processor/jobs/execute-withdraws.job';
import { IntentProcessorQueueType } from '@eco-solver/intent-processor/queues/intent-processor.queue';
import { ExecuteSendBatchJobData } from '@eco-solver/intent-processor/jobs/execute-send-batch.job';
export declare class IntentProcessorService implements OnApplicationBootstrap {
    private readonly ecoConfigService;
    private readonly indexerService;
    private readonly walletClientDefaultSignerService;
    private logger;
    private config;
    private readonly intentProcessorQueue;
    constructor(queue: IntentProcessorQueueType, ecoConfigService: EcoConfigService, indexerService: IndexerService, walletClientDefaultSignerService: WalletClientDefaultSignerService);
    onApplicationBootstrap(): Promise<void>;
    getNextBatchWithdrawals(): Promise<void>;
    getNextSendBatch(): Promise<void>;
    executeWithdrawals(data: ExecuteWithdrawsJobData): Promise<void>;
    executeSendBatch(data: ExecuteSendBatchJobData): Promise<void>;
    /**
     * Aggregates transactions using a Multicall contract
     * @param chainId
     * @param transactions
     * @private
     */
    private sendTransactions;
    private getIntentSource;
    private getInboxForIntentSource;
    private getInbox;
    /**
     * Get sendBatch transaction data
     * @param publicClient
     * @param inbox
     * @param prover
     * @param source
     * @param intentHashes
     * @private
     */
    private getSendBatchTransaction;
    private estimateMessageGas;
}
