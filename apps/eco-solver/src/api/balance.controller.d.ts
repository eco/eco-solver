import { BalanceService } from '@eco-solver/balance/balance.service';
import { TokenBalance, TokenConfig } from '@eco-solver/balance/types';
export declare class BalanceController {
    private readonly balanceService;
    constructor(balanceService: BalanceService);
    getBalances(flat?: boolean): Promise<any>;
    groupTokensByChain(data: {
        config: TokenConfig;
        balance: TokenBalance;
        chainId: number;
    }[]): {
        [x: string]: {
            address: `0x${string}`;
            balance: bigint;
        }[];
    };
}
