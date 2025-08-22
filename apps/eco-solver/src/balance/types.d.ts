import { TargetContractType } from '@libs/solver-config';
import { Hex } from 'viem';
export type TokenConfig = {
    address: Hex;
    chainId: number;
    minBalance: number;
    targetBalance: number;
    type: TargetContractType;
};
export type TokenBalance = {
    address: Hex;
    decimals: number;
    balance: bigint;
};
