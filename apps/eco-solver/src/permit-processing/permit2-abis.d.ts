import { Hex } from 'viem';
export declare const Permit2SinglePermitAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly components: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "token";
                readonly type: "address";
            }, {
                readonly internalType: "uint160";
                readonly name: "amount";
                readonly type: "uint160";
            }, {
                readonly internalType: "uint48";
                readonly name: "expiration";
                readonly type: "uint48";
            }, {
                readonly internalType: "uint48";
                readonly name: "nonce";
                readonly type: "uint48";
            }];
            readonly internalType: "struct IAllowanceTransfer.PermitDetails";
            readonly name: "details";
            readonly type: "tuple";
        }, {
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "sigDeadline";
            readonly type: "uint256";
        }];
        readonly internalType: "struct IAllowanceTransfer.PermitSingle";
        readonly name: "permitSingle";
        readonly type: "tuple";
    }, {
        readonly internalType: "bytes";
        readonly name: "signature";
        readonly type: "bytes";
    }];
    readonly name: "permit";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
export declare const Permit2BatchPermitAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly components: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "token";
                readonly type: "address";
            }, {
                readonly internalType: "uint160";
                readonly name: "amount";
                readonly type: "uint160";
            }, {
                readonly internalType: "uint48";
                readonly name: "expiration";
                readonly type: "uint48";
            }, {
                readonly internalType: "uint48";
                readonly name: "nonce";
                readonly type: "uint48";
            }];
            readonly internalType: "struct IAllowanceTransfer.PermitDetails[]";
            readonly name: "details";
            readonly type: "tuple[]";
        }, {
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "sigDeadline";
            readonly type: "uint256";
        }];
        readonly internalType: "struct IAllowanceTransfer.PermitBatch";
        readonly name: "permitBatch";
        readonly type: "tuple";
    }, {
        readonly internalType: "bytes";
        readonly name: "signature";
        readonly type: "bytes";
    }];
    readonly name: "permit";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
export interface PermitSingleArg {
    details: PermitDetails;
    spender: Hex;
    sigDeadline: bigint;
}
export interface PermitBatchArg {
    details: PermitDetails[];
    spender: `0x${string}`;
    sigDeadline: bigint;
}
type PermitDetails = {
    token: Hex;
    amount: bigint;
    expiration: number;
    nonce: number;
};
export {};
