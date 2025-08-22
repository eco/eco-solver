import { CommandRunner } from 'nest-commander';
import { EcoConfigService } from '@libs/solver-config';
import { BalanceService } from '@eco-solver/balance/balance.service';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
export declare abstract class ClientCommand extends CommandRunner {
    protected readonly balanceService: BalanceService;
    protected readonly kernelAccountClientService: KernelAccountClientService;
    protected readonly ecoConfigService: EcoConfigService;
    constructor(balanceService: BalanceService, kernelAccountClientService: KernelAccountClientService, ecoConfigService: EcoConfigService);
    getClient(chainID?: number): Promise<{
        account: import("viem").Account;
        batch?: import("viem").ClientConfig["batch"] | undefined;
        cacheTime: number;
        ccipRead?: import("viem").ClientConfig["ccipRead"] | undefined;
        chain: import("viem").Chain;
        key: string;
        name: string;
        pollingInterval: number;
        request: import("viem").EIP1193RequestFn<[{
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: import("viem").Prettify<import("viem").WalletCapabilitiesRecord>;
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, {
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: import("viem").Prettify<import("viem").WalletCapabilitiesRecord>;
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, {
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: import("viem").Prettify<import("viem").WalletCapabilitiesRecord>;
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, ...any[]]>;
        transport: import("viem").TransportConfig<string, import("viem").EIP1193RequestFn> & Record<string, any>;
        type: string;
        uid: string;
        addChain: (args: import("viem").AddChainParameters) => Promise<void>;
        deployContract: <const abi extends import("viem").Abi | readonly unknown[], chainOverride extends import("viem").Chain | undefined>(args: import("viem").DeployContractParameters<abi, import("viem").Chain, import("viem").Account, chainOverride>) => Promise<import("viem").DeployContractReturnType>;
        getAddresses: () => Promise<import("viem").GetAddressesReturnType>;
        getCallsStatus: (parameters: import("viem").GetCallsStatusParameters) => Promise<import("viem").GetCallsStatusReturnType>;
        getCapabilities: <chainId extends number | undefined>(parameters?: import("viem").GetCapabilitiesParameters<chainId>) => Promise<import("viem").GetCapabilitiesReturnType<chainId>>;
        getChainId: (() => Promise<import("viem").GetChainIdReturnType>) & (() => Promise<import("viem").GetChainIdReturnType>);
        getPermissions: () => Promise<import("viem").GetPermissionsReturnType>;
        prepareAuthorization: (parameters: import("viem").PrepareAuthorizationParameters<import("viem").Account>) => Promise<import("viem").PrepareAuthorizationReturnType>;
        prepareTransactionRequest: (<const request extends import("viem").PrepareTransactionRequestRequest<import("viem").Chain, chainOverride>, chainOverride extends import("viem").Chain | undefined = undefined, accountOverride extends import("viem").Account | import("viem").Address | undefined = undefined>(args: import("viem").PrepareTransactionRequestParameters<import("viem").Chain, import("viem").Account, chainOverride, accountOverride, request>) => Promise<import("viem").UnionRequiredBy<Extract<import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from"> & (import("viem").DeriveChain<import("viem").Chain, chainOverride> extends infer T_14 ? T_14 extends import("viem").DeriveChain<import("viem").Chain, chainOverride> ? T_14 extends import("viem").Chain ? {
            chain: T_14;
        } : {
            chain?: undefined;
        } : never : never) & (import("viem").DeriveAccount<import("viem").Account, accountOverride> extends infer T_15 ? T_15 extends import("viem").DeriveAccount<import("viem").Account, accountOverride> ? T_15 extends import("viem").Account ? {
            account: T_15;
            from: import("viem").Address;
        } : {
            account?: undefined;
            from?: undefined;
        } : never : never), import("viem").IsNever<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_16 ? T_16 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_16 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_17 ? T_17 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_17 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_18 ? T_18 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_18 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_19 ? T_19 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_19 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_20 ? T_20 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_20 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)> extends true ? unknown : import("viem").ExactPartial<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_21 ? T_21 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_21 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_22 ? T_22 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_22 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_23 ? T_23 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_23 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_24 ? T_24 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_24 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_25 ? T_25 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_25 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)>> & {
            chainId?: number | undefined;
        }, (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") extends infer T_26 ? T_26 extends (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") ? T_26 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_26 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">) extends infer T ? { [K in keyof T]: (import("viem").UnionRequiredBy<Extract<import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from"> & (import("viem").DeriveChain<import("viem").Chain, chainOverride> extends infer T_1 ? T_1 extends import("viem").DeriveChain<import("viem").Chain, chainOverride> ? T_1 extends import("viem").Chain ? {
            chain: T_1;
        } : {
            chain?: undefined;
        } : never : never) & (import("viem").DeriveAccount<import("viem").Account, accountOverride> extends infer T_2 ? T_2 extends import("viem").DeriveAccount<import("viem").Account, accountOverride> ? T_2 extends import("viem").Account ? {
            account: T_2;
            from: import("viem").Address;
        } : {
            account?: undefined;
            from?: undefined;
        } : never : never), import("viem").IsNever<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_3 ? T_3 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_3 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_4 ? T_4 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_4 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_5 ? T_5 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_5 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_6 ? T_6 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_6 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_7 ? T_7 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_7 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)> extends true ? unknown : import("viem").ExactPartial<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_8 ? T_8 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_8 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_9 ? T_9 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_9 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_10 ? T_10 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_10 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_11 ? T_11 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_11 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_12 ? T_12 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_12 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)>> & {
            chainId?: number | undefined;
        }, (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") extends infer T_13 ? T_13 extends (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") ? T_13 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_13 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">))[K]; } : never>) & (<const request extends import("viem").PrepareTransactionRequestRequest<import("viem").Chain, chainOverride>, chainOverride extends import("viem").Chain | undefined = undefined, accountOverride extends import("viem").Account | import("viem").Address | undefined = undefined>(args: import("viem").PrepareTransactionRequestParameters<import("viem").Chain, import("viem").Account, chainOverride, accountOverride, request>) => Promise<import("viem").UnionRequiredBy<Extract<import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from"> & (import("viem").DeriveChain<import("viem").Chain, chainOverride> extends infer T_14 ? T_14 extends import("viem").DeriveChain<import("viem").Chain, chainOverride> ? T_14 extends import("viem").Chain ? {
            chain: T_14;
        } : {
            chain?: undefined;
        } : never : never) & (import("viem").DeriveAccount<import("viem").Account, accountOverride> extends infer T_15 ? T_15 extends import("viem").DeriveAccount<import("viem").Account, accountOverride> ? T_15 extends import("viem").Account ? {
            account: T_15;
            from: import("viem").Address;
        } : {
            account?: undefined;
            from?: undefined;
        } : never : never), import("viem").IsNever<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_16 ? T_16 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_16 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_17 ? T_17 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_17 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_18 ? T_18 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_18 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_19 ? T_19 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_19 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_20 ? T_20 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_20 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)> extends true ? unknown : import("viem").ExactPartial<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_21 ? T_21 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_21 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_22 ? T_22 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_22 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_23 ? T_23 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_23 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_24 ? T_24 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_24 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_25 ? T_25 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_25 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)>> & {
            chainId?: number | undefined;
        }, (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") extends infer T_26 ? T_26 extends (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") ? T_26 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_26 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">) extends infer T ? { [K in keyof T]: (import("viem").UnionRequiredBy<Extract<import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from"> & (import("viem").DeriveChain<import("viem").Chain, chainOverride> extends infer T_1 ? T_1 extends import("viem").DeriveChain<import("viem").Chain, chainOverride> ? T_1 extends import("viem").Chain ? {
            chain: T_1;
        } : {
            chain?: undefined;
        } : never : never) & (import("viem").DeriveAccount<import("viem").Account, accountOverride> extends infer T_2 ? T_2 extends import("viem").DeriveAccount<import("viem").Account, accountOverride> ? T_2 extends import("viem").Account ? {
            account: T_2;
            from: import("viem").Address;
        } : {
            account?: undefined;
            from?: undefined;
        } : never : never), import("viem").IsNever<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_3 ? T_3 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_3 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_4 ? T_4 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_4 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_5 ? T_5 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_5 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_6 ? T_6 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_6 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_7 ? T_7 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_7 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)> extends true ? unknown : import("viem").ExactPartial<((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_8 ? T_8 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_8 extends "legacy" ? import("viem").TransactionRequestLegacy : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_9 ? T_9 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_9 extends "eip1559" ? import("viem").TransactionRequestEIP1559 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_10 ? T_10 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_10 extends "eip2930" ? import("viem").TransactionRequestEIP2930 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_11 ? T_11 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_11 extends "eip4844" ? import("viem").TransactionRequestEIP4844 : never : never : never) | ((request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) extends infer T_12 ? T_12 extends (request["type"] extends string ? request["type"] : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>) ? T_12 extends "eip7702" ? import("viem").TransactionRequestEIP7702 : never : never : never)>> & {
            chainId?: number | undefined;
        }, (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") extends infer T_13 ? T_13 extends (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") ? T_13 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_13 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">))[K]; } : never>);
        requestAddresses: () => Promise<import("viem").RequestAddressesReturnType>;
        requestPermissions: (args: import("viem").RequestPermissionsParameters) => Promise<import("viem").RequestPermissionsReturnType>;
        sendCalls: <const calls extends readonly unknown[], chainOverride extends import("viem").Chain | undefined = undefined>(parameters: import("viem").SendCallsParameters<import("viem").Chain, import("viem").Account, chainOverride, calls>) => Promise<{
            capabilities?: {
                [x: string]: any;
            };
            id: string;
        }>;
        sendRawTransaction: ((args: import("viem").SendRawTransactionParameters) => Promise<import("viem").SendRawTransactionReturnType>) & ((args: import("viem").SendRawTransactionParameters) => Promise<import("viem").SendRawTransactionReturnType>);
        sendTransaction: <const request extends import("viem").SendTransactionRequest<import("viem").Chain, chainOverride>, chainOverride extends import("viem").Chain | undefined = undefined>(args: import("viem").SendTransactionParameters<import("viem").Chain, import("viem").Account, chainOverride, request>) => Promise<import("viem").SendTransactionReturnType>;
        showCallsStatus: (parameters: import("viem").ShowCallsStatusParameters) => Promise<import("viem").ShowCallsStatusReturnType>;
        signAuthorization: (parameters: import("viem").SignAuthorizationParameters<import("viem").Account>) => Promise<import("viem").SignAuthorizationReturnType>;
        signMessage: (args: import("viem").SignMessageParameters<import("viem").Account>) => Promise<import("viem").SignMessageReturnType>;
        signTransaction: <chainOverride extends import("viem").Chain | undefined, const request extends import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from"> = import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from">>(args: import("viem").SignTransactionParameters<import("viem").Chain, import("viem").Account, chainOverride, request>) => Promise<import("viem").TransactionSerialized<import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)>, (import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends infer T ? T extends import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> ? T extends "eip1559" ? `0x02${string}` : never : never : never) | (import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends infer T_1 ? T_1 extends import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> ? T_1 extends "eip2930" ? `0x01${string}` : never : never : never) | (import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends infer T_2 ? T_2 extends import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> ? T_2 extends "eip4844" ? `0x03${string}` : never : never : never) | (import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends infer T_3 ? T_3 extends import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> ? T_3 extends "eip7702" ? `0x04${string}` : never : never : never) | (import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> extends infer T_4 ? T_4 extends import("viem").GetTransactionType<request, (request extends {
            accessList?: undefined;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
        } & import("viem").FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } & (import("viem").OneOf<{
            maxFeePerGas: import("viem").FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: import("viem").FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, import("viem").FeeValuesEIP1559> & {
            accessList?: import("viem").TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: bigint;
            sidecars?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
        } & {
            accessList: import("viem").TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: undefined;
            blobs?: readonly `0x${string}`[] | readonly import("viem").ByteArray[];
            blobVersionedHashes?: readonly `0x${string}`[];
            maxFeePerBlobGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: false | readonly import("viem").BlobSidecar<`0x${string}`>[];
        }) & (import("viem").ExactPartial<import("viem").FeeValuesEIP4844> & import("viem").OneOf<{
            blobs: import("viem").TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: import("viem").TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: import("viem").TransactionSerializableEIP4844["sidecars"];
        }, import("viem").TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        } | {
            accessList?: import("viem").AccessList;
            authorizationList?: import("viem").SignedAuthorizationList;
            blobs?: undefined;
            blobVersionedHashes?: undefined;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            sidecars?: undefined;
        }) & {
            authorizationList: import("viem").TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string ? Extract<request["type"], string> : never)> ? T_4 extends "legacy" ? import("viem").TransactionSerializedLegacy : never : never : never)>>;
        signTypedData: <const typedData extends {
            [x: string]: readonly import("viem").TypedDataParameter[];
            [x: `string[${string}]`]: never;
            [x: `function[${string}]`]: never;
            [x: `address[${string}]`]: never;
            [x: `bool[${string}]`]: never;
            [x: `bytes[${string}]`]: never;
            [x: `bytes2[${string}]`]: never;
            [x: `bytes1[${string}]`]: never;
            [x: `bytes3[${string}]`]: never;
            [x: `bytes4[${string}]`]: never;
            [x: `bytes5[${string}]`]: never;
            [x: `bytes6[${string}]`]: never;
            [x: `bytes7[${string}]`]: never;
            [x: `bytes8[${string}]`]: never;
            [x: `bytes9[${string}]`]: never;
            [x: `bytes10[${string}]`]: never;
            [x: `bytes11[${string}]`]: never;
            [x: `bytes12[${string}]`]: never;
            [x: `bytes13[${string}]`]: never;
            [x: `bytes14[${string}]`]: never;
            [x: `bytes15[${string}]`]: never;
            [x: `bytes16[${string}]`]: never;
            [x: `bytes17[${string}]`]: never;
            [x: `bytes18[${string}]`]: never;
            [x: `bytes19[${string}]`]: never;
            [x: `bytes20[${string}]`]: never;
            [x: `bytes21[${string}]`]: never;
            [x: `bytes22[${string}]`]: never;
            [x: `bytes23[${string}]`]: never;
            [x: `bytes24[${string}]`]: never;
            [x: `bytes25[${string}]`]: never;
            [x: `bytes26[${string}]`]: never;
            [x: `bytes27[${string}]`]: never;
            [x: `bytes28[${string}]`]: never;
            [x: `bytes29[${string}]`]: never;
            [x: `bytes30[${string}]`]: never;
            [x: `bytes31[${string}]`]: never;
            [x: `bytes32[${string}]`]: never;
            [x: `int[${string}]`]: never;
            [x: `int8[${string}]`]: never;
            [x: `int16[${string}]`]: never;
            [x: `int24[${string}]`]: never;
            [x: `int32[${string}]`]: never;
            [x: `int40[${string}]`]: never;
            [x: `int48[${string}]`]: never;
            [x: `int56[${string}]`]: never;
            [x: `int64[${string}]`]: never;
            [x: `int72[${string}]`]: never;
            [x: `int80[${string}]`]: never;
            [x: `int88[${string}]`]: never;
            [x: `int96[${string}]`]: never;
            [x: `int104[${string}]`]: never;
            [x: `int112[${string}]`]: never;
            [x: `int120[${string}]`]: never;
            [x: `int128[${string}]`]: never;
            [x: `int136[${string}]`]: never;
            [x: `int144[${string}]`]: never;
            [x: `int152[${string}]`]: never;
            [x: `int160[${string}]`]: never;
            [x: `int168[${string}]`]: never;
            [x: `int176[${string}]`]: never;
            [x: `int184[${string}]`]: never;
            [x: `int192[${string}]`]: never;
            [x: `int200[${string}]`]: never;
            [x: `int208[${string}]`]: never;
            [x: `int216[${string}]`]: never;
            [x: `int224[${string}]`]: never;
            [x: `int232[${string}]`]: never;
            [x: `int240[${string}]`]: never;
            [x: `int248[${string}]`]: never;
            [x: `int256[${string}]`]: never;
            [x: `uint[${string}]`]: never;
            [x: `uint8[${string}]`]: never;
            [x: `uint16[${string}]`]: never;
            [x: `uint24[${string}]`]: never;
            [x: `uint32[${string}]`]: never;
            [x: `uint40[${string}]`]: never;
            [x: `uint48[${string}]`]: never;
            [x: `uint56[${string}]`]: never;
            [x: `uint64[${string}]`]: never;
            [x: `uint72[${string}]`]: never;
            [x: `uint80[${string}]`]: never;
            [x: `uint88[${string}]`]: never;
            [x: `uint96[${string}]`]: never;
            [x: `uint104[${string}]`]: never;
            [x: `uint112[${string}]`]: never;
            [x: `uint120[${string}]`]: never;
            [x: `uint128[${string}]`]: never;
            [x: `uint136[${string}]`]: never;
            [x: `uint144[${string}]`]: never;
            [x: `uint152[${string}]`]: never;
            [x: `uint160[${string}]`]: never;
            [x: `uint168[${string}]`]: never;
            [x: `uint176[${string}]`]: never;
            [x: `uint184[${string}]`]: never;
            [x: `uint192[${string}]`]: never;
            [x: `uint200[${string}]`]: never;
            [x: `uint208[${string}]`]: never;
            [x: `uint216[${string}]`]: never;
            [x: `uint224[${string}]`]: never;
            [x: `uint232[${string}]`]: never;
            [x: `uint240[${string}]`]: never;
            [x: `uint248[${string}]`]: never;
            [x: `uint256[${string}]`]: never;
            string?: never;
            address?: never;
            bool?: never;
            bytes?: never;
            bytes2?: never;
            bytes1?: never;
            bytes3?: never;
            bytes4?: never;
            bytes5?: never;
            bytes6?: never;
            bytes7?: never;
            bytes8?: never;
            bytes9?: never;
            bytes10?: never;
            bytes11?: never;
            bytes12?: never;
            bytes13?: never;
            bytes14?: never;
            bytes15?: never;
            bytes16?: never;
            bytes17?: never;
            bytes18?: never;
            bytes19?: never;
            bytes20?: never;
            bytes21?: never;
            bytes22?: never;
            bytes23?: never;
            bytes24?: never;
            bytes25?: never;
            bytes26?: never;
            bytes27?: never;
            bytes28?: never;
            bytes29?: never;
            bytes30?: never;
            bytes31?: never;
            bytes32?: never;
            int8?: never;
            int16?: never;
            int24?: never;
            int32?: never;
            int40?: never;
            int48?: never;
            int56?: never;
            int64?: never;
            int72?: never;
            int80?: never;
            int88?: never;
            int96?: never;
            int104?: never;
            int112?: never;
            int120?: never;
            int128?: never;
            int136?: never;
            int144?: never;
            int152?: never;
            int160?: never;
            int168?: never;
            int176?: never;
            int184?: never;
            int192?: never;
            int200?: never;
            int208?: never;
            int216?: never;
            int224?: never;
            int232?: never;
            int240?: never;
            int248?: never;
            int256?: never;
            uint8?: never;
            uint16?: never;
            uint24?: never;
            uint32?: never;
            uint40?: never;
            uint48?: never;
            uint56?: never;
            uint64?: never;
            uint72?: never;
            uint80?: never;
            uint88?: never;
            uint96?: never;
            uint104?: never;
            uint112?: never;
            uint120?: never;
            uint128?: never;
            uint136?: never;
            uint144?: never;
            uint152?: never;
            uint160?: never;
            uint168?: never;
            uint176?: never;
            uint184?: never;
            uint192?: never;
            uint200?: never;
            uint208?: never;
            uint216?: never;
            uint224?: never;
            uint232?: never;
            uint240?: never;
            uint248?: never;
            uint256?: never;
        } | {
            [key: string]: unknown;
        }, primaryType extends string>(args: import("viem").SignTypedDataParameters<typedData, primaryType, import("viem").Account>) => Promise<import("viem").SignTypedDataReturnType>;
        switchChain: (args: import("viem").SwitchChainParameters) => Promise<void>;
        waitForCallsStatus: (parameters: import("viem").WaitForCallsStatusParameters) => Promise<import("viem").WaitForCallsStatusReturnType>;
        watchAsset: (args: import("viem").WatchAssetParameters) => Promise<import("viem").WatchAssetReturnType>;
        writeContract: <const abi extends import("viem").Abi | readonly unknown[], functionName extends import("viem").ContractFunctionName<abi, "nonpayable" | "payable">, args_1 extends import("viem").ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>, chainOverride extends import("viem").Chain | undefined = undefined>(args: import("viem").WriteContractParameters<abi, functionName, args_1, import("viem").Chain, import("viem").Account, chainOverride>) => Promise<import("viem").WriteContractReturnType>;
        extend: <const client extends {
            [x: string]: unknown;
            account?: undefined;
            batch?: undefined;
            cacheTime?: undefined;
            ccipRead?: undefined;
            chain?: undefined;
            key?: undefined;
            name?: undefined;
            pollingInterval?: undefined;
            request?: undefined;
            transport?: undefined;
            type?: undefined;
            uid?: undefined;
        } & import("viem").ExactPartial<Pick<import("viem").PublicActions<import("viem").Transport, import("viem").Chain, import("viem").Account>, "call" | "createContractEventFilter" | "createEventFilter" | "estimateContractGas" | "estimateGas" | "getBlock" | "getBlockNumber" | "getChainId" | "getContractEvents" | "getEnsText" | "getFilterChanges" | "getGasPrice" | "getLogs" | "getTransaction" | "getTransactionCount" | "getTransactionReceipt" | "prepareTransactionRequest" | "readContract" | "sendRawTransaction" | "simulateContract" | "uninstallFilter" | "watchBlockNumber" | "watchContractEvent"> & Pick<import("viem").WalletActions<import("viem").Chain, import("viem").Account>, "sendTransaction" | "writeContract">>>(fn: (client: import("viem").Client<import("viem").Transport, import("viem").Chain, import("viem").Account, [{
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: {
                [x: `0x${string}`]: {
                    [key: string]: any;
                };
            };
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, {
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: {
                [x: `0x${string}`]: {
                    [key: string]: any;
                };
            };
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, {
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: {
                [x: `0x${string}`]: {
                    [key: string]: any;
                };
            };
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, ...any[]], import("viem").WalletActions<import("viem").Chain, import("viem").Account>>) => client) => import("viem").Client<import("viem").Transport, import("viem").Chain, import("viem").Account, [{
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: {
                [x: `0x${string}`]: {
                    [key: string]: any;
                };
            };
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, {
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: {
                [x: `0x${string}`]: {
                    [key: string]: any;
                };
            };
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, {
            Method: "eth_accounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_requestAccounts";
            Parameters?: undefined;
            ReturnType: import("viem").Address[];
        }, {
            Method: "eth_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: import("viem").Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_sign";
            Parameters: [address: import("viem").Address, data: import("viem").Hex];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTransaction";
            Parameters: [request: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_signTypedData_v4";
            Parameters: [address: import("viem").Address, message: string];
            ReturnType: import("viem").Hex;
        }, {
            Method: "eth_syncing";
            Parameters?: undefined;
            ReturnType: import("viem").NetworkSync | false;
        }, {
            Method: "personal_sign";
            Parameters: [data: import("viem").Hex, address: import("viem").Address];
            ReturnType: import("viem").Hex;
        }, {
            Method: "wallet_addEthereumChain";
            Parameters: [chain: import("viem").AddEthereumChainParameter];
            ReturnType: null;
        }, {
            Method: "wallet_addSubAccount";
            Parameters: [{
                account: import("viem").OneOf<{
                    keys: readonly {
                        publicKey: import("viem").Hex;
                        type: "address" | "p256" | "webcrypto-p256" | "webauthn-p256";
                    }[];
                    type: "create";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    type: "deployed";
                } | {
                    address: import("viem").Address;
                    chainId?: number | undefined;
                    factory: import("viem").Address;
                    factoryData: import("viem").Hex;
                    type: "undeployed";
                }>;
                version: string;
            }];
            ReturnType: {
                address: import("viem").Address;
                factory?: import("viem").Address | undefined;
                factoryData?: import("viem").Hex | undefined;
            };
        }, {
            Method: "wallet_connect";
            Parameters: [{
                capabilities?: import("viem").Capabilities | undefined;
                version: string;
            }];
            ReturnType: {
                accounts: readonly {
                    address: import("viem").Address;
                    capabilities?: import("viem").Capabilities | undefined;
                }[];
            };
        }, {
            Method: "wallet_disconnect";
            Parameters?: undefined;
            ReturnType: void;
        }, {
            Method: "wallet_getCallsStatus";
            Parameters?: [string];
            ReturnType: import("viem").WalletGetCallsStatusReturnType;
        }, {
            Method: "wallet_getCapabilities";
            Parameters?: readonly [] | readonly [import("viem").Address | undefined] | readonly [import("viem").Address | undefined, readonly import("viem").Hex[] | undefined] | undefined;
            ReturnType: {
                [x: `0x${string}`]: {
                    [key: string]: any;
                };
            };
        }, {
            Method: "wallet_getPermissions";
            Parameters?: undefined;
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_grantPermissions";
            Parameters?: [import("viem").WalletGrantPermissionsParameters];
            ReturnType: import("viem").Prettify<import("viem").WalletGrantPermissionsReturnType>;
        }, {
            Method: "wallet_requestPermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: import("viem").WalletPermission[];
        }, {
            Method: "wallet_revokePermissions";
            Parameters: [permissions: {
                eth_accounts: Record<string, any>;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_sendCalls";
            Parameters?: import("viem").WalletSendCallsParameters;
            ReturnType: import("viem").WalletSendCallsReturnType;
        }, {
            Method: "wallet_sendTransaction";
            Parameters: [transaction: import("viem").RpcTransactionRequest];
            ReturnType: import("viem").Hash;
        }, {
            Method: "wallet_showCallsStatus";
            Parameters?: [string];
            ReturnType: void;
        }, {
            Method: "wallet_switchEthereumChain";
            Parameters: [chain: {
                chainId: string;
            }];
            ReturnType: null;
        }, {
            Method: "wallet_watchAsset";
            Parameters: import("viem").WatchAssetParams;
            ReturnType: boolean;
        }, ...any[]], { [K in keyof client]: client[K]; } & import("viem").WalletActions<import("viem").Chain, import("viem").Account>>;
        call: (parameters: import("viem").CallParameters<import("viem").Chain>) => Promise<import("viem").CallReturnType>;
        createAccessList: (parameters: import("viem").CreateAccessListParameters<import("viem").Chain>) => Promise<{
            accessList: import("viem").AccessList;
            gasUsed: bigint;
        }>;
        createBlockFilter: () => Promise<import("viem").CreateBlockFilterReturnType>;
        createContractEventFilter: <const abi extends import("viem").Abi | readonly unknown[], eventName extends import("viem").ContractEventName<abi> | undefined, args extends import("viem").MaybeExtractEventArgsFromAbi<abi, eventName> | undefined, strict extends boolean | undefined = undefined, fromBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, toBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined>(args: import("viem").CreateContractEventFilterParameters<abi, eventName, args, strict, fromBlock, toBlock>) => Promise<import("viem").CreateContractEventFilterReturnType<abi, eventName, args, strict, fromBlock, toBlock>>;
        createEventFilter: <const abiEvent extends import("viem").AbiEvent | undefined = undefined, const abiEvents extends readonly import("viem").AbiEvent[] | readonly unknown[] | undefined = abiEvent extends import("viem").AbiEvent ? [abiEvent] : undefined, strict extends boolean | undefined = undefined, fromBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, toBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, _EventName extends string | undefined = import("viem").MaybeAbiEventName<abiEvent>, _Args extends import("viem").MaybeExtractEventArgsFromAbi<abiEvents, _EventName> | undefined = undefined>(args?: import("viem").CreateEventFilterParameters<abiEvent, abiEvents, strict, fromBlock, toBlock, _EventName, _Args> | undefined) => Promise<import("viem").CreateEventFilterReturnType<abiEvent, abiEvents, strict, fromBlock, toBlock, _EventName, _Args>>;
        createPendingTransactionFilter: () => Promise<import("viem").CreatePendingTransactionFilterReturnType>;
        estimateContractGas: <chain extends import("viem").Chain | undefined, const abi extends import("viem").Abi | readonly unknown[], functionName extends import("viem").ContractFunctionName<abi, "nonpayable" | "payable">, args extends import("viem").ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>>(args: import("viem").EstimateContractGasParameters<abi, functionName, args, chain>) => Promise<import("viem").EstimateContractGasReturnType>;
        estimateGas: (args: import("viem").EstimateGasParameters<import("viem").Chain>) => Promise<import("viem").EstimateGasReturnType>;
        getBalance: (args: import("viem").GetBalanceParameters) => Promise<import("viem").GetBalanceReturnType>;
        getBlobBaseFee: () => Promise<import("viem").GetBlobBaseFeeReturnType>;
        getBlock: <includeTransactions extends boolean = false, blockTag extends import("viem").BlockTag = "latest">(args?: import("viem").GetBlockParameters<includeTransactions, blockTag>) => Promise<{
            number: blockTag extends "pending" ? null : bigint;
            hash: blockTag extends "pending" ? null : `0x${string}`;
            nonce: blockTag extends "pending" ? null : `0x${string}`;
            logsBloom: blockTag extends "pending" ? null : `0x${string}`;
            baseFeePerGas: bigint;
            blobGasUsed: bigint;
            difficulty: bigint;
            excessBlobGas: bigint;
            extraData: import("viem").Hex;
            gasLimit: bigint;
            gasUsed: bigint;
            miner: import("viem").Address;
            mixHash: import("viem").Hash;
            parentBeaconBlockRoot?: import("viem").Hex | undefined;
            parentHash: import("viem").Hash;
            receiptsRoot: import("viem").Hex;
            sealFields: import("viem").Hex[];
            sha3Uncles: import("viem").Hash;
            size: bigint;
            stateRoot: import("viem").Hash;
            timestamp: bigint;
            totalDifficulty: bigint;
            transactionsRoot: import("viem").Hash;
            uncles: import("viem").Hash[];
            withdrawals?: import("viem").Withdrawal[] | undefined;
            withdrawalsRoot?: import("viem").Hex | undefined;
            transactions: includeTransactions extends true ? ({
                type: "legacy";
                hash: import("viem").Hash;
                value: bigint;
                yParity?: undefined;
                from: import("viem").Address;
                gas: bigint;
                input: import("viem").Hex;
                nonce: number;
                r: import("viem").Hex;
                s: import("viem").Hex;
                to: import("viem").Address | null;
                typeHex: import("viem").Hex | null;
                v: bigint;
                accessList?: undefined;
                authorizationList?: undefined;
                blobVersionedHashes?: undefined;
                chainId?: number;
                gasPrice: bigint;
                maxFeePerBlobGas?: undefined;
                maxFeePerGas?: undefined;
                maxPriorityFeePerGas?: undefined;
                blockNumber: (blockTag extends "pending" ? true : false) extends infer T ? T extends (blockTag extends "pending" ? true : false) ? T extends true ? null : bigint : never : never;
                blockHash: (blockTag extends "pending" ? true : false) extends infer T_1 ? T_1 extends (blockTag extends "pending" ? true : false) ? T_1 extends true ? null : `0x${string}` : never : never;
                transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_2 ? T_2 extends (blockTag extends "pending" ? true : false) ? T_2 extends true ? null : number : never : never;
            } | {
                type: "eip2930";
                hash: import("viem").Hash;
                value: bigint;
                yParity: number;
                from: import("viem").Address;
                gas: bigint;
                input: import("viem").Hex;
                nonce: number;
                r: import("viem").Hex;
                s: import("viem").Hex;
                to: import("viem").Address | null;
                typeHex: import("viem").Hex | null;
                v: bigint;
                accessList: import("viem").AccessList;
                authorizationList?: undefined;
                blobVersionedHashes?: undefined;
                chainId: number;
                gasPrice: bigint;
                maxFeePerBlobGas?: undefined;
                maxFeePerGas?: undefined;
                maxPriorityFeePerGas?: undefined;
                blockNumber: (blockTag extends "pending" ? true : false) extends infer T_3 ? T_3 extends (blockTag extends "pending" ? true : false) ? T_3 extends true ? null : bigint : never : never;
                blockHash: (blockTag extends "pending" ? true : false) extends infer T_4 ? T_4 extends (blockTag extends "pending" ? true : false) ? T_4 extends true ? null : `0x${string}` : never : never;
                transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_5 ? T_5 extends (blockTag extends "pending" ? true : false) ? T_5 extends true ? null : number : never : never;
            } | {
                type: "eip1559";
                hash: import("viem").Hash;
                value: bigint;
                yParity: number;
                from: import("viem").Address;
                gas: bigint;
                input: import("viem").Hex;
                nonce: number;
                r: import("viem").Hex;
                s: import("viem").Hex;
                to: import("viem").Address | null;
                typeHex: import("viem").Hex | null;
                v: bigint;
                accessList: import("viem").AccessList;
                authorizationList?: undefined;
                blobVersionedHashes?: undefined;
                chainId: number;
                gasPrice?: undefined;
                maxFeePerBlobGas?: undefined;
                maxFeePerGas: bigint;
                maxPriorityFeePerGas: bigint;
                blockNumber: (blockTag extends "pending" ? true : false) extends infer T_6 ? T_6 extends (blockTag extends "pending" ? true : false) ? T_6 extends true ? null : bigint : never : never;
                blockHash: (blockTag extends "pending" ? true : false) extends infer T_7 ? T_7 extends (blockTag extends "pending" ? true : false) ? T_7 extends true ? null : `0x${string}` : never : never;
                transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_8 ? T_8 extends (blockTag extends "pending" ? true : false) ? T_8 extends true ? null : number : never : never;
            } | {
                type: "eip4844";
                hash: import("viem").Hash;
                value: bigint;
                yParity: number;
                from: import("viem").Address;
                gas: bigint;
                input: import("viem").Hex;
                nonce: number;
                r: import("viem").Hex;
                s: import("viem").Hex;
                to: import("viem").Address | null;
                typeHex: import("viem").Hex | null;
                v: bigint;
                accessList: import("viem").AccessList;
                authorizationList?: undefined;
                blobVersionedHashes: readonly import("viem").Hex[];
                chainId: number;
                gasPrice?: undefined;
                maxFeePerBlobGas: bigint;
                maxFeePerGas: bigint;
                maxPriorityFeePerGas: bigint;
                blockNumber: (blockTag extends "pending" ? true : false) extends infer T_9 ? T_9 extends (blockTag extends "pending" ? true : false) ? T_9 extends true ? null : bigint : never : never;
                blockHash: (blockTag extends "pending" ? true : false) extends infer T_10 ? T_10 extends (blockTag extends "pending" ? true : false) ? T_10 extends true ? null : `0x${string}` : never : never;
                transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_11 ? T_11 extends (blockTag extends "pending" ? true : false) ? T_11 extends true ? null : number : never : never;
            } | {
                type: "eip7702";
                hash: import("viem").Hash;
                value: bigint;
                yParity: number;
                from: import("viem").Address;
                gas: bigint;
                input: import("viem").Hex;
                nonce: number;
                r: import("viem").Hex;
                s: import("viem").Hex;
                to: import("viem").Address | null;
                typeHex: import("viem").Hex | null;
                v: bigint;
                accessList: import("viem").AccessList;
                authorizationList: import("viem").SignedAuthorizationList;
                blobVersionedHashes?: undefined;
                chainId: number;
                gasPrice?: undefined;
                maxFeePerBlobGas?: undefined;
                maxFeePerGas: bigint;
                maxPriorityFeePerGas: bigint;
                blockNumber: (blockTag extends "pending" ? true : false) extends infer T_12 ? T_12 extends (blockTag extends "pending" ? true : false) ? T_12 extends true ? null : bigint : never : never;
                blockHash: (blockTag extends "pending" ? true : false) extends infer T_13 ? T_13 extends (blockTag extends "pending" ? true : false) ? T_13 extends true ? null : `0x${string}` : never : never;
                transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_14 ? T_14 extends (blockTag extends "pending" ? true : false) ? T_14 extends true ? null : number : never : never;
            })[] : `0x${string}`[];
        }>;
        getBlockNumber: (args?: import("viem").GetBlockNumberParameters | undefined) => Promise<import("viem").GetBlockNumberReturnType>;
        getBlockTransactionCount: (args?: import("viem").GetBlockTransactionCountParameters | undefined) => Promise<import("viem").GetBlockTransactionCountReturnType>;
        getBytecode: (args: import("viem").GetBytecodeParameters) => Promise<import("viem").GetBytecodeReturnType>;
        getCode: (args: import("viem").GetBytecodeParameters) => Promise<import("viem").GetBytecodeReturnType>;
        getContractEvents: <const abi extends import("viem").Abi | readonly unknown[], eventName extends import("viem").ContractEventName<abi> | undefined = undefined, strict extends boolean | undefined = undefined, fromBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, toBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined>(args: import("viem").GetContractEventsParameters<abi, eventName, strict, fromBlock, toBlock>) => Promise<import("viem").GetContractEventsReturnType<abi, eventName, strict, fromBlock, toBlock>>;
        getEip712Domain: (args: import("viem").GetEip712DomainParameters) => Promise<import("viem").GetEip712DomainReturnType>;
        getEnsAddress: (args: import("viem").GetEnsAddressParameters) => Promise<import("viem").GetEnsAddressReturnType>;
        getEnsAvatar: (args: import("viem").GetEnsAvatarParameters) => Promise<import("viem").GetEnsAvatarReturnType>;
        getEnsName: (args: import("viem").GetEnsNameParameters) => Promise<import("viem").GetEnsNameReturnType>;
        getEnsResolver: (args: import("viem").GetEnsResolverParameters) => Promise<import("viem").GetEnsResolverReturnType>;
        getEnsText: (args: import("viem").GetEnsTextParameters) => Promise<import("viem").GetEnsTextReturnType>;
        getFeeHistory: (args: import("viem").GetFeeHistoryParameters) => Promise<import("viem").GetFeeHistoryReturnType>;
        estimateFeesPerGas: <chainOverride extends import("viem").Chain | undefined = undefined, type extends import("viem").FeeValuesType = "eip1559">(args?: import("viem").EstimateFeesPerGasParameters<import("viem").Chain, chainOverride, type>) => Promise<import("viem").EstimateFeesPerGasReturnType<type>>;
        getFilterChanges: <filterType extends import("viem").FilterType, const abi extends import("viem").Abi | readonly unknown[] | undefined, eventName extends string | undefined, strict extends boolean | undefined = undefined, fromBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, toBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined>(args: import("viem").GetFilterChangesParameters<filterType, abi, eventName, strict, fromBlock, toBlock>) => Promise<import("viem").GetFilterChangesReturnType<filterType, abi, eventName, strict, fromBlock, toBlock>>;
        getFilterLogs: <const abi extends import("viem").Abi | readonly unknown[] | undefined, eventName extends string | undefined, strict extends boolean | undefined = undefined, fromBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, toBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined>(args: import("viem").GetFilterLogsParameters<abi, eventName, strict, fromBlock, toBlock>) => Promise<import("viem").GetFilterLogsReturnType<abi, eventName, strict, fromBlock, toBlock>>;
        getGasPrice: () => Promise<import("viem").GetGasPriceReturnType>;
        getLogs: <const abiEvent extends import("viem").AbiEvent | undefined = undefined, const abiEvents extends readonly import("viem").AbiEvent[] | readonly unknown[] | undefined = abiEvent extends import("viem").AbiEvent ? [abiEvent] : undefined, strict extends boolean | undefined = undefined, fromBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined, toBlock extends import("viem").BlockNumber | import("viem").BlockTag | undefined = undefined>(args?: import("viem").GetLogsParameters<abiEvent, abiEvents, strict, fromBlock, toBlock> | undefined) => Promise<import("viem").GetLogsReturnType<abiEvent, abiEvents, strict, fromBlock, toBlock>>;
        getProof: (args: import("viem").GetProofParameters) => Promise<import("viem").GetProofReturnType>;
        estimateMaxPriorityFeePerGas: <chainOverride extends import("viem").Chain | undefined = undefined>(args?: {
            chain: chainOverride;
        }) => Promise<import("viem").EstimateMaxPriorityFeePerGasReturnType>;
        getStorageAt: (args: import("viem").GetStorageAtParameters) => Promise<import("viem").GetStorageAtReturnType>;
        getTransaction: <blockTag extends import("viem").BlockTag = "latest">(args: import("viem").GetTransactionParameters<blockTag>) => Promise<{
            type: "legacy";
            hash: import("viem").Hash;
            value: bigint;
            yParity?: undefined;
            from: import("viem").Address;
            gas: bigint;
            input: import("viem").Hex;
            nonce: number;
            r: import("viem").Hex;
            s: import("viem").Hex;
            to: import("viem").Address | null;
            typeHex: import("viem").Hex | null;
            v: bigint;
            accessList?: undefined;
            authorizationList?: undefined;
            blobVersionedHashes?: undefined;
            chainId?: number;
            gasPrice: bigint;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T ? T extends (blockTag extends "pending" ? true : false) ? T extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_1 ? T_1 extends (blockTag extends "pending" ? true : false) ? T_1 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_2 ? T_2 extends (blockTag extends "pending" ? true : false) ? T_2 extends true ? null : number : never : never;
        } | {
            type: "eip2930";
            hash: import("viem").Hash;
            value: bigint;
            yParity: number;
            from: import("viem").Address;
            gas: bigint;
            input: import("viem").Hex;
            nonce: number;
            r: import("viem").Hex;
            s: import("viem").Hex;
            to: import("viem").Address | null;
            typeHex: import("viem").Hex | null;
            v: bigint;
            accessList: import("viem").AccessList;
            authorizationList?: undefined;
            blobVersionedHashes?: undefined;
            chainId: number;
            gasPrice: bigint;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas?: undefined;
            maxPriorityFeePerGas?: undefined;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_3 ? T_3 extends (blockTag extends "pending" ? true : false) ? T_3 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_4 ? T_4 extends (blockTag extends "pending" ? true : false) ? T_4 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_5 ? T_5 extends (blockTag extends "pending" ? true : false) ? T_5 extends true ? null : number : never : never;
        } | {
            type: "eip1559";
            hash: import("viem").Hash;
            value: bigint;
            yParity: number;
            from: import("viem").Address;
            gas: bigint;
            input: import("viem").Hex;
            nonce: number;
            r: import("viem").Hex;
            s: import("viem").Hex;
            to: import("viem").Address | null;
            typeHex: import("viem").Hex | null;
            v: bigint;
            accessList: import("viem").AccessList;
            authorizationList?: undefined;
            blobVersionedHashes?: undefined;
            chainId: number;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_6 ? T_6 extends (blockTag extends "pending" ? true : false) ? T_6 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_7 ? T_7 extends (blockTag extends "pending" ? true : false) ? T_7 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_8 ? T_8 extends (blockTag extends "pending" ? true : false) ? T_8 extends true ? null : number : never : never;
        } | {
            type: "eip4844";
            hash: import("viem").Hash;
            value: bigint;
            yParity: number;
            from: import("viem").Address;
            gas: bigint;
            input: import("viem").Hex;
            nonce: number;
            r: import("viem").Hex;
            s: import("viem").Hex;
            to: import("viem").Address | null;
            typeHex: import("viem").Hex | null;
            v: bigint;
            accessList: import("viem").AccessList;
            authorizationList?: undefined;
            blobVersionedHashes: readonly import("viem").Hex[];
            chainId: number;
            gasPrice?: undefined;
            maxFeePerBlobGas: bigint;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_9 ? T_9 extends (blockTag extends "pending" ? true : false) ? T_9 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_10 ? T_10 extends (blockTag extends "pending" ? true : false) ? T_10 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_11 ? T_11 extends (blockTag extends "pending" ? true : false) ? T_11 extends true ? null : number : never : never;
        } | {
            type: "eip7702";
            hash: import("viem").Hash;
            value: bigint;
            yParity: number;
            from: import("viem").Address;
            gas: bigint;
            input: import("viem").Hex;
            nonce: number;
            r: import("viem").Hex;
            s: import("viem").Hex;
            to: import("viem").Address | null;
            typeHex: import("viem").Hex | null;
            v: bigint;
            accessList: import("viem").AccessList;
            authorizationList: import("viem").SignedAuthorizationList;
            blobVersionedHashes?: undefined;
            chainId: number;
            gasPrice?: undefined;
            maxFeePerBlobGas?: undefined;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_12 ? T_12 extends (blockTag extends "pending" ? true : false) ? T_12 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_13 ? T_13 extends (blockTag extends "pending" ? true : false) ? T_13 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_14 ? T_14 extends (blockTag extends "pending" ? true : false) ? T_14 extends true ? null : number : never : never;
        }>;
        getTransactionConfirmations: (args: import("viem").GetTransactionConfirmationsParameters<import("viem").Chain>) => Promise<import("viem").GetTransactionConfirmationsReturnType>;
        getTransactionCount: (args: import("viem").GetTransactionCountParameters) => Promise<import("viem").GetTransactionCountReturnType>;
        getTransactionReceipt: (args: import("viem").GetTransactionReceiptParameters) => Promise<import("viem").TransactionReceipt>;
        multicall: <const contracts extends readonly unknown[], allowFailure extends boolean = true>(args: import("viem").MulticallParameters<contracts, allowFailure>) => Promise<import("viem").MulticallReturnType<contracts, allowFailure>>;
        readContract: <const abi extends import("viem").Abi | readonly unknown[], functionName extends import("viem").ContractFunctionName<abi, "pure" | "view">, const args extends import("viem").ContractFunctionArgs<abi, "pure" | "view", functionName>>(args: import("viem").ReadContractParameters<abi, functionName, args>) => Promise<import("viem").ReadContractReturnType<abi, functionName, args>>;
        simulate: <const calls extends readonly unknown[]>(args: import("viem").SimulateBlocksParameters<calls>) => Promise<import("viem").SimulateBlocksReturnType<calls>>;
        simulateBlocks: <const calls extends readonly unknown[]>(args: import("viem").SimulateBlocksParameters<calls>) => Promise<import("viem").SimulateBlocksReturnType<calls>>;
        simulateCalls: <const calls extends readonly unknown[]>(args: import("viem").SimulateCallsParameters<calls>) => Promise<import("viem").SimulateCallsReturnType<calls>>;
        simulateContract: <const abi extends import("viem").Abi | readonly unknown[], functionName extends import("viem").ContractFunctionName<abi, "nonpayable" | "payable">, const args_1 extends import("viem").ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>, chainOverride extends import("viem").Chain | undefined, accountOverride extends import("viem").Account | import("viem").Address | undefined = undefined>(args: import("viem").SimulateContractParameters<abi, functionName, args_1, import("viem").Chain, chainOverride, accountOverride>) => Promise<import("viem").SimulateContractReturnType<abi, functionName, args_1, import("viem").Chain, import("viem").Account, chainOverride, accountOverride>>;
        verifyMessage: (args: import("viem").VerifyMessageActionParameters) => Promise<import("viem").VerifyMessageActionReturnType>;
        verifySiweMessage: (args: import("viem/_types/actions/siwe/verifySiweMessage").VerifySiweMessageParameters) => Promise<import("viem/_types/actions/siwe/verifySiweMessage").VerifySiweMessageReturnType>;
        verifyTypedData: (args: import("viem").VerifyTypedDataActionParameters) => Promise<import("viem").VerifyTypedDataActionReturnType>;
        uninstallFilter: (args: import("viem").UninstallFilterParameters) => Promise<import("viem").UninstallFilterReturnType>;
        waitForTransactionReceipt: (args: import("viem").WaitForTransactionReceiptParameters<import("viem").Chain>) => Promise<import("viem").TransactionReceipt>;
        watchBlockNumber: (args: import("viem").WatchBlockNumberParameters) => import("viem").WatchBlockNumberReturnType;
        watchBlocks: <includeTransactions extends boolean = false, blockTag extends import("viem").BlockTag = "latest">(args: import("viem").WatchBlocksParameters<import("viem").Transport, import("viem").Chain, includeTransactions, blockTag>) => import("viem").WatchBlocksReturnType;
        watchContractEvent: <const abi extends import("viem").Abi | readonly unknown[], eventName extends import("viem").ContractEventName<abi>, strict extends boolean | undefined = undefined>(args: import("viem").WatchContractEventParameters<abi, eventName, strict, import("viem").Transport>) => import("viem").WatchContractEventReturnType;
        watchEvent: <const abiEvent extends import("viem").AbiEvent | undefined = undefined, const abiEvents extends readonly import("viem").AbiEvent[] | readonly unknown[] | undefined = abiEvent extends import("viem").AbiEvent ? [abiEvent] : undefined, strict extends boolean | undefined = undefined>(args: import("viem").WatchEventParameters<abiEvent, abiEvents, strict, import("viem").Transport>) => import("viem").WatchEventReturnType;
        watchPendingTransactions: (args: import("viem").WatchPendingTransactionsParameters<import("viem").Transport>) => import("viem").WatchPendingTransactionsReturnType;
        execute: (args: import("../../transaction/smart-wallets/smart-wallet.types").ExecuteSmartWalletArgs) => Promise<import("viem").Hex>;
        deployKernelAccount: () => Promise<import("../../transaction/smart-wallets/kernel").DeployFactoryArgs>;
        kernelAccount: import("permissionless/accounts").ToEcdsaKernelSmartAccountReturnType<"0.7">;
        kernelAccountAddress: import("viem").Hex;
    }>;
    getWalletAddress(chainID?: number): Promise<`0x${string}`>;
}
