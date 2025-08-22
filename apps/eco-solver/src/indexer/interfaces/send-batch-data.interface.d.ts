import { Hex } from 'viem';
export interface SendBatchData {
    hash: Hex;
    chainId: number;
    intentCreatedTxHash: Hex;
    destinationChainId: number;
    intentSourceAddr: Hex;
    prover: Hex;
    claimant: Hex;
}
