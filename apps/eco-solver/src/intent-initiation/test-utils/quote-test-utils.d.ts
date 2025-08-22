import { ClassConstructor } from 'class-transformer';
import { GaslessIntentRequestDTO } from '@eco-solver/quote/dto/gasless-intent-request.dto';
import { Hex } from 'viem';
import { QuoteDataEntryDTO } from '@eco-solver/quote/dto/quote-data-entry.dto';
import { QuoteIntentDataDTO } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { QuoteIntentModel } from '@eco-solver/quote/schemas/quote-intent.schema';
import { QuoteRewardDataDTO } from '@eco-solver/quote/dto/quote.reward.data.dto';
import { QuoteRouteDataDTO } from '@eco-solver/quote/dto/quote.route.data.dto';
declare class MockWalletClientDefaultSignerService {
    getClient(): Promise<{
        writeContract: jest.Mock<any, any, any>;
        sendTransaction: jest.Mock<any, any, any>;
    }>;
    getPublicClient(): Promise<{
        account: undefined;
        batch?: import("viem").ClientConfig["batch"] | undefined;
        cacheTime: number;
        ccipRead?: import("viem").ClientConfig["ccipRead"] | undefined;
        chain: import("viem").Chain;
        key: string;
        name: string;
        pollingInterval: number;
        request: import("viem").EIP1193RequestFn<[{
            Method: "web3_clientVersion";
            Parameters?: undefined;
            ReturnType: string;
        }, {
            Method: "web3_sha3";
            Parameters: [data: import("viem").Hash];
            ReturnType: string;
        }, {
            Method: "net_listening";
            Parameters?: undefined;
            ReturnType: boolean;
        }, {
            Method: "net_peerCount";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "net_version";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_blobBaseFee";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_blockNumber";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_call";
            Parameters: readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier, stateOverrideSet: import("viem").RpcStateOverride] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier, stateOverrideSet: import("viem").RpcStateOverride, blockOverrides: import("viem").RpcBlockOverrides];
            ReturnType: Hex;
        }, {
            Method: "eth_createAccessList";
            Parameters: [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>] | [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: {
                accessList: import("viem").AccessList;
                gasUsed: import("viem").Quantity;
            };
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_coinbase";
            Parameters?: undefined;
            ReturnType: import("viem").Address;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_feeHistory";
            Parameters: [blockCount: import("viem").Quantity, newestBlock: import("viem").RpcBlockNumber | import("viem").BlockTag, rewardPercentiles: number[] | undefined];
            ReturnType: import("viem").RpcFeeHistory;
        }, {
            Method: "eth_gasPrice";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBalance";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBlockByHash";
            Parameters: [hash: import("viem").Hash, includeTransactionObjects: boolean];
            ReturnType: import("viem").RpcBlock | null;
        }, {
            Method: "eth_getBlockByNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, includeTransactionObjects: boolean];
            ReturnType: import("viem").RpcBlock | null;
        }, {
            Method: "eth_getBlockTransactionCountByHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBlockTransactionCountByNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getCode";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: Hex;
        }, {
            Method: "eth_getFilterChanges";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: import("viem").RpcLog[] | Hex[];
        }, {
            Method: "eth_getFilterLogs";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: import("viem").RpcLog[];
        }, {
            Method: "eth_getLogs";
            Parameters: [{
                address?: import("viem").Address | import("viem").Address[] | undefined;
                topics?: import("viem").LogTopic[] | undefined;
            } & ({
                fromBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                toBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                blockHash?: undefined;
            } | {
                fromBlock?: undefined;
                toBlock?: undefined;
                blockHash?: import("viem").Hash | undefined;
            })];
            ReturnType: import("viem").RpcLog[];
        }, {
            Method: "eth_getProof";
            Parameters: [address: import("viem").Address, storageKeys: import("viem").Hash[], block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").RpcProof;
        }, {
            Method: "eth_getStorageAt";
            Parameters: [address: import("viem").Address, index: import("viem").Quantity, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: Hex;
        }, {
            Method: "eth_getTransactionByBlockHashAndIndex";
            Parameters: [hash: import("viem").Hash, index: import("viem").Quantity];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionByBlockNumberAndIndex";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, index: import("viem").Quantity];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionByHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionCount";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getTransactionReceipt";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").RpcTransactionReceipt | null;
        }, {
            Method: "eth_getUncleByBlockHashAndIndex";
            Parameters: [hash: import("viem").Hash, index: import("viem").Quantity];
            ReturnType: import("viem").RpcUncle | null;
        }, {
            Method: "eth_getUncleByBlockNumberAndIndex";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, index: import("viem").Quantity];
            ReturnType: import("viem").RpcUncle | null;
        }, {
            Method: "eth_getUncleCountByBlockHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getUncleCountByBlockNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_maxPriorityFeePerGas";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newBlockFilter";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newFilter";
            Parameters: [filter: {
                fromBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                toBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                address?: import("viem").Address | import("viem").Address[] | undefined;
                topics?: import("viem").LogTopic[] | undefined;
            }];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newPendingTransactionFilter";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_protocolVersion";
            Parameters?: undefined;
            ReturnType: string;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_simulateV1";
            Parameters: [{
                blockStateCalls: readonly {
                    blockOverrides?: import("viem").RpcBlockOverrides | undefined;
                    calls?: readonly import("viem").ExactPartial<import("viem").RpcTransactionRequest>[] | undefined;
                    stateOverrides?: import("viem").RpcStateOverride | undefined;
                }[];
                returnFullTransactions?: boolean | undefined;
                traceTransfers?: boolean | undefined;
                validation?: boolean | undefined;
            }, import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: readonly (import("viem").RpcBlock & {
                calls: readonly {
                    error?: {
                        data?: Hex | undefined;
                        code: number;
                        message: string;
                    } | undefined;
                    logs?: readonly import("viem").RpcLog[] | undefined;
                    gasUsed: Hex;
                    returnData: Hex;
                    status: Hex;
                }[];
            })[];
        }, {
            Method: "eth_uninstallFilter";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: boolean;
        }, ...any[]]>;
        transport: import("viem").TransportConfig<string, import("viem").EIP1193RequestFn> & Record<string, any>;
        type: string;
        uid: string;
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
            extraData: Hex;
            gasLimit: bigint;
            gasUsed: bigint;
            miner: import("viem").Address;
            mixHash: import("viem").Hash;
            parentBeaconBlockRoot?: Hex | undefined;
            parentHash: import("viem").Hash;
            receiptsRoot: Hex;
            sealFields: Hex[];
            sha3Uncles: import("viem").Hash;
            size: bigint;
            stateRoot: import("viem").Hash;
            timestamp: bigint;
            totalDifficulty: bigint;
            transactionsRoot: import("viem").Hash;
            uncles: import("viem").Hash[];
            withdrawals?: import("viem").Withdrawal[] | undefined;
            withdrawalsRoot?: Hex | undefined;
            transactions: includeTransactions extends true ? ({
                type: "legacy";
                hash: import("viem").Hash;
                value: bigint;
                yParity?: undefined;
                from: import("viem").Address;
                gas: bigint;
                input: Hex;
                nonce: number;
                r: Hex;
                s: Hex;
                to: import("viem").Address | null;
                typeHex: Hex | null;
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
                input: Hex;
                nonce: number;
                r: Hex;
                s: Hex;
                to: import("viem").Address | null;
                typeHex: Hex | null;
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
                input: Hex;
                nonce: number;
                r: Hex;
                s: Hex;
                to: import("viem").Address | null;
                typeHex: Hex | null;
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
                input: Hex;
                nonce: number;
                r: Hex;
                s: Hex;
                to: import("viem").Address | null;
                typeHex: Hex | null;
                v: bigint;
                accessList: import("viem").AccessList;
                authorizationList?: undefined;
                blobVersionedHashes: readonly Hex[];
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
                input: Hex;
                nonce: number;
                r: Hex;
                s: Hex;
                to: import("viem").Address | null;
                typeHex: Hex | null;
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
        getChainId: () => Promise<import("viem").GetChainIdReturnType>;
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
            input: Hex;
            nonce: number;
            r: Hex;
            s: Hex;
            to: import("viem").Address | null;
            typeHex: Hex | null;
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
            input: Hex;
            nonce: number;
            r: Hex;
            s: Hex;
            to: import("viem").Address | null;
            typeHex: Hex | null;
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
            input: Hex;
            nonce: number;
            r: Hex;
            s: Hex;
            to: import("viem").Address | null;
            typeHex: Hex | null;
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
            input: Hex;
            nonce: number;
            r: Hex;
            s: Hex;
            to: import("viem").Address | null;
            typeHex: Hex | null;
            v: bigint;
            accessList: import("viem").AccessList;
            authorizationList?: undefined;
            blobVersionedHashes: readonly Hex[];
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
            input: Hex;
            nonce: number;
            r: Hex;
            s: Hex;
            to: import("viem").Address | null;
            typeHex: Hex | null;
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
        prepareTransactionRequest: <const request extends import("viem").PrepareTransactionRequestRequest<import("viem").Chain, chainOverride>, chainOverride extends import("viem").Chain | undefined = undefined, accountOverride extends import("viem").Account | import("viem").Address | undefined = undefined>(args: import("viem").PrepareTransactionRequestParameters<import("viem").Chain, import("viem").Account, chainOverride, accountOverride, request>) => Promise<import("viem").UnionRequiredBy<Extract<import("viem").UnionOmit<import("viem").ExtractChainFormatterParameters<import("viem").DeriveChain<import("viem").Chain, chainOverride>, "transactionRequest", import("viem").TransactionRequest>, "from"> & (import("viem").DeriveChain<import("viem").Chain, chainOverride> extends infer T_14 ? T_14 extends import("viem").DeriveChain<import("viem").Chain, chainOverride> ? T_14 extends import("viem").Chain ? {
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
        }, (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") extends infer T_13 ? T_13 extends (request["parameters"] extends readonly import("viem").PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "type" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "chainId") ? T_13 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_13 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">))[K]; } : never>;
        readContract: <const abi extends import("viem").Abi | readonly unknown[], functionName extends import("viem").ContractFunctionName<abi, "pure" | "view">, const args extends import("viem").ContractFunctionArgs<abi, "pure" | "view", functionName>>(args: import("viem").ReadContractParameters<abi, functionName, args>) => Promise<import("viem").ReadContractReturnType<abi, functionName, args>>;
        sendRawTransaction: (args: import("viem").SendRawTransactionParameters) => Promise<import("viem").SendRawTransactionReturnType>;
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
        } & import("viem").ExactPartial<Pick<import("viem").PublicActions<import("viem").Transport, import("viem").Chain, undefined>, "call" | "createContractEventFilter" | "createEventFilter" | "estimateContractGas" | "estimateGas" | "getBlock" | "getBlockNumber" | "getChainId" | "getContractEvents" | "getEnsText" | "getFilterChanges" | "getGasPrice" | "getLogs" | "getTransaction" | "getTransactionCount" | "getTransactionReceipt" | "prepareTransactionRequest" | "readContract" | "sendRawTransaction" | "simulateContract" | "uninstallFilter" | "watchBlockNumber" | "watchContractEvent"> & Pick<import("viem").WalletActions<import("viem").Chain, undefined>, "sendTransaction" | "writeContract">>>(fn: (client: import("viem").Client<import("viem").Transport, import("viem").Chain, undefined, [{
            Method: "web3_clientVersion";
            Parameters?: undefined;
            ReturnType: string;
        }, {
            Method: "web3_sha3";
            Parameters: [data: import("viem").Hash];
            ReturnType: string;
        }, {
            Method: "net_listening";
            Parameters?: undefined;
            ReturnType: boolean;
        }, {
            Method: "net_peerCount";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "net_version";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_blobBaseFee";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_blockNumber";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_call";
            Parameters: readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier, stateOverrideSet: import("viem").RpcStateOverride] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier, stateOverrideSet: import("viem").RpcStateOverride, blockOverrides: import("viem").RpcBlockOverrides];
            ReturnType: Hex;
        }, {
            Method: "eth_createAccessList";
            Parameters: [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>] | [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: {
                accessList: import("viem").AccessList;
                gasUsed: import("viem").Quantity;
            };
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_coinbase";
            Parameters?: undefined;
            ReturnType: import("viem").Address;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_feeHistory";
            Parameters: [blockCount: import("viem").Quantity, newestBlock: import("viem").RpcBlockNumber | import("viem").BlockTag, rewardPercentiles: number[] | undefined];
            ReturnType: import("viem").RpcFeeHistory;
        }, {
            Method: "eth_gasPrice";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBalance";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBlockByHash";
            Parameters: [hash: import("viem").Hash, includeTransactionObjects: boolean];
            ReturnType: import("viem").RpcBlock | null;
        }, {
            Method: "eth_getBlockByNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, includeTransactionObjects: boolean];
            ReturnType: import("viem").RpcBlock | null;
        }, {
            Method: "eth_getBlockTransactionCountByHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBlockTransactionCountByNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getCode";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: Hex;
        }, {
            Method: "eth_getFilterChanges";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: import("viem").RpcLog[] | Hex[];
        }, {
            Method: "eth_getFilterLogs";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: import("viem").RpcLog[];
        }, {
            Method: "eth_getLogs";
            Parameters: [{
                address?: import("viem").Address | import("viem").Address[] | undefined;
                topics?: import("viem").LogTopic[] | undefined;
            } & ({
                fromBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                toBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                blockHash?: undefined;
            } | {
                fromBlock?: undefined;
                toBlock?: undefined;
                blockHash?: import("viem").Hash | undefined;
            })];
            ReturnType: import("viem").RpcLog[];
        }, {
            Method: "eth_getProof";
            Parameters: [address: import("viem").Address, storageKeys: import("viem").Hash[], block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").RpcProof;
        }, {
            Method: "eth_getStorageAt";
            Parameters: [address: import("viem").Address, index: import("viem").Quantity, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: Hex;
        }, {
            Method: "eth_getTransactionByBlockHashAndIndex";
            Parameters: [hash: import("viem").Hash, index: import("viem").Quantity];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionByBlockNumberAndIndex";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, index: import("viem").Quantity];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionByHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionCount";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getTransactionReceipt";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").RpcTransactionReceipt | null;
        }, {
            Method: "eth_getUncleByBlockHashAndIndex";
            Parameters: [hash: import("viem").Hash, index: import("viem").Quantity];
            ReturnType: import("viem").RpcUncle | null;
        }, {
            Method: "eth_getUncleByBlockNumberAndIndex";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, index: import("viem").Quantity];
            ReturnType: import("viem").RpcUncle | null;
        }, {
            Method: "eth_getUncleCountByBlockHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getUncleCountByBlockNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_maxPriorityFeePerGas";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newBlockFilter";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newFilter";
            Parameters: [filter: {
                fromBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                toBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                address?: import("viem").Address | import("viem").Address[] | undefined;
                topics?: import("viem").LogTopic[] | undefined;
            }];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newPendingTransactionFilter";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_protocolVersion";
            Parameters?: undefined;
            ReturnType: string;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_simulateV1";
            Parameters: [{
                blockStateCalls: readonly {
                    blockOverrides?: import("viem").RpcBlockOverrides | undefined;
                    calls?: readonly import("viem").ExactPartial<import("viem").RpcTransactionRequest>[] | undefined;
                    stateOverrides?: import("viem").RpcStateOverride | undefined;
                }[];
                returnFullTransactions?: boolean | undefined;
                traceTransfers?: boolean | undefined;
                validation?: boolean | undefined;
            }, import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: readonly (import("viem").RpcBlock & {
                calls: readonly {
                    error?: {
                        data?: Hex | undefined;
                        code: number;
                        message: string;
                    } | undefined;
                    logs?: readonly import("viem").RpcLog[] | undefined;
                    gasUsed: Hex;
                    returnData: Hex;
                    status: Hex;
                }[];
            })[];
        }, {
            Method: "eth_uninstallFilter";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: boolean;
        }, ...any[]], import("viem").PublicActions<import("viem").Transport, import("viem").Chain>>) => client) => import("viem").Client<import("viem").Transport, import("viem").Chain, undefined, [{
            Method: "web3_clientVersion";
            Parameters?: undefined;
            ReturnType: string;
        }, {
            Method: "web3_sha3";
            Parameters: [data: import("viem").Hash];
            ReturnType: string;
        }, {
            Method: "net_listening";
            Parameters?: undefined;
            ReturnType: boolean;
        }, {
            Method: "net_peerCount";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "net_version";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_blobBaseFee";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_blockNumber";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_call";
            Parameters: readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier, stateOverrideSet: import("viem").RpcStateOverride] | readonly [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier, stateOverrideSet: import("viem").RpcStateOverride, blockOverrides: import("viem").RpcBlockOverrides];
            ReturnType: Hex;
        }, {
            Method: "eth_createAccessList";
            Parameters: [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>] | [transaction: import("viem").ExactPartial<import("viem").RpcTransactionRequest>, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: {
                accessList: import("viem").AccessList;
                gasUsed: import("viem").Quantity;
            };
        }, {
            Method: "eth_chainId";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_coinbase";
            Parameters?: undefined;
            ReturnType: import("viem").Address;
        }, {
            Method: "eth_estimateGas";
            Parameters: [transaction: import("viem").RpcTransactionRequest] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag] | [transaction: import("viem").RpcTransactionRequest, block: import("viem").RpcBlockNumber | import("viem").BlockTag, stateOverride: import("viem").RpcStateOverride];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_feeHistory";
            Parameters: [blockCount: import("viem").Quantity, newestBlock: import("viem").RpcBlockNumber | import("viem").BlockTag, rewardPercentiles: number[] | undefined];
            ReturnType: import("viem").RpcFeeHistory;
        }, {
            Method: "eth_gasPrice";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBalance";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBlockByHash";
            Parameters: [hash: import("viem").Hash, includeTransactionObjects: boolean];
            ReturnType: import("viem").RpcBlock | null;
        }, {
            Method: "eth_getBlockByNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, includeTransactionObjects: boolean];
            ReturnType: import("viem").RpcBlock | null;
        }, {
            Method: "eth_getBlockTransactionCountByHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getBlockTransactionCountByNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getCode";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: Hex;
        }, {
            Method: "eth_getFilterChanges";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: import("viem").RpcLog[] | Hex[];
        }, {
            Method: "eth_getFilterLogs";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: import("viem").RpcLog[];
        }, {
            Method: "eth_getLogs";
            Parameters: [{
                address?: import("viem").Address | import("viem").Address[] | undefined;
                topics?: import("viem").LogTopic[] | undefined;
            } & ({
                fromBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                toBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                blockHash?: undefined;
            } | {
                fromBlock?: undefined;
                toBlock?: undefined;
                blockHash?: import("viem").Hash | undefined;
            })];
            ReturnType: import("viem").RpcLog[];
        }, {
            Method: "eth_getProof";
            Parameters: [address: import("viem").Address, storageKeys: import("viem").Hash[], block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").RpcProof;
        }, {
            Method: "eth_getStorageAt";
            Parameters: [address: import("viem").Address, index: import("viem").Quantity, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: Hex;
        }, {
            Method: "eth_getTransactionByBlockHashAndIndex";
            Parameters: [hash: import("viem").Hash, index: import("viem").Quantity];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionByBlockNumberAndIndex";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, index: import("viem").Quantity];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionByHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").RpcTransaction | null;
        }, {
            Method: "eth_getTransactionCount";
            Parameters: [address: import("viem").Address, block: import("viem").RpcBlockNumber | import("viem").BlockTag | import("viem").RpcBlockIdentifier];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getTransactionReceipt";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").RpcTransactionReceipt | null;
        }, {
            Method: "eth_getUncleByBlockHashAndIndex";
            Parameters: [hash: import("viem").Hash, index: import("viem").Quantity];
            ReturnType: import("viem").RpcUncle | null;
        }, {
            Method: "eth_getUncleByBlockNumberAndIndex";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag, index: import("viem").Quantity];
            ReturnType: import("viem").RpcUncle | null;
        }, {
            Method: "eth_getUncleCountByBlockHash";
            Parameters: [hash: import("viem").Hash];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_getUncleCountByBlockNumber";
            Parameters: [block: import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_maxPriorityFeePerGas";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newBlockFilter";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newFilter";
            Parameters: [filter: {
                fromBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                toBlock?: import("viem").RpcBlockNumber | import("viem").BlockTag | undefined;
                address?: import("viem").Address | import("viem").Address[] | undefined;
                topics?: import("viem").LogTopic[] | undefined;
            }];
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_newPendingTransactionFilter";
            Parameters?: undefined;
            ReturnType: import("viem").Quantity;
        }, {
            Method: "eth_protocolVersion";
            Parameters?: undefined;
            ReturnType: string;
        }, {
            Method: "eth_sendRawTransaction";
            Parameters: [signedTransaction: Hex];
            ReturnType: import("viem").Hash;
        }, {
            Method: "eth_simulateV1";
            Parameters: [{
                blockStateCalls: readonly {
                    blockOverrides?: import("viem").RpcBlockOverrides | undefined;
                    calls?: readonly import("viem").ExactPartial<import("viem").RpcTransactionRequest>[] | undefined;
                    stateOverrides?: import("viem").RpcStateOverride | undefined;
                }[];
                returnFullTransactions?: boolean | undefined;
                traceTransfers?: boolean | undefined;
                validation?: boolean | undefined;
            }, import("viem").RpcBlockNumber | import("viem").BlockTag];
            ReturnType: readonly (import("viem").RpcBlock & {
                calls: readonly {
                    error?: {
                        data?: Hex | undefined;
                        code: number;
                        message: string;
                    } | undefined;
                    logs?: readonly import("viem").RpcLog[] | undefined;
                    gasUsed: Hex;
                    returnData: Hex;
                    status: Hex;
                }[];
            })[];
        }, {
            Method: "eth_uninstallFilter";
            Parameters: [filterId: import("viem").Quantity];
            ReturnType: boolean;
        }, ...any[]], { [K in keyof client]: client[K]; } & import("viem").PublicActions<import("viem").Transport, import("viem").Chain>>;
    }>;
}
export declare class QuoteTestUtils {
    getRandomHexString(len: number): string;
    getRandomAddress(): Hex;
    createQuoteIntentModel(overrides?: Partial<QuoteIntentModel>): QuoteIntentModel;
    createQuoteDataEntryDTO(overrides?: Partial<QuoteDataEntryDTO>): QuoteDataEntryDTO;
    createQuoteIntentDataDTO(overrides?: Partial<QuoteIntentDataDTO>): QuoteIntentDataDTO;
    getQuoteIntentModel(intentExecutionType: string, quoteIntentDataDTO: QuoteIntentDataDTO): QuoteIntentModel;
    private getRouteHash;
    asQuoteIntentModel(dto: GaslessIntentRequestDTO): QuoteIntentModel;
    createQuoteRouteDataDTO(overrides?: Partial<QuoteRouteDataDTO>): QuoteRouteDataDTO;
    createQuoteRewardDataDTO(overrides?: Partial<QuoteRewardDataDTO>): QuoteRewardDataDTO;
    getMockWalletClientDefaultSignerService(): ClassConstructor<MockWalletClientDefaultSignerService>;
}
export {};
