import { ExecuteSmartWalletArgs } from './smart-wallet.types';
/**
 * Throws if we don`t support value send in batch transactions, {@link SimpleAccountClient}
 * @param transactions the transactions to execute
 */
export declare function throwIfValueSendInBatch(transactions: ExecuteSmartWalletArgs): void;
