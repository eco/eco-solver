import { Hex } from 'viem';
import { CommandRunner } from 'nest-commander';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { BalanceService } from '@eco-solver/balance/balance.service';
export declare class TransferCommand extends CommandRunner {
    private readonly kernelAccountClientService;
    private readonly balanceService;
    constructor(kernelAccountClientService: KernelAccountClientService, balanceService: BalanceService);
    run(passedParams: string[], options?: Record<string, any>): Promise<void>;
    parseToken(val: string): `0x${string}`;
    parseAmount(val: string): bigint;
    parseChainID(val: string): number;
    parseEverything(val: string): boolean;
    parseNative(val: string): bigint;
    /**
     * Transfers a token to a recipient
     * @param chainID the chain id
     * @param token the token address
     * @param recipient the recipient address
     * @param amount the amount to transfer, assumes in correct decimal format for that token
     */
    transferToken(chainID: number, token: Hex, recipient: Hex, amount: bigint): Promise<void>;
    /**
     * Sends all the tokens on a given chain to a recipient
     * @param chainID the chain id
     * @param recipient the recipient address
     * @returns
     */
    transferTokens(chainID: number, recipient: Hex): Promise<void>;
    /**
     * Transfers native tokens to a recipient
     * @param chainID the chain id
     * @param recipient the recipient address
     * @param amount the amount to transfer in wei format
     */
    transferNative(chainID: number, recipient: Hex, amount: bigint): Promise<void>;
}
