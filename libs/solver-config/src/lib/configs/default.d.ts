declare const _default: {
    aws: {
        region: string;
        secretID: string;
    }[];
    cache: {
        ttl: number;
    };
    redis: {
        options: {
            single: {
                autoResubscribe: boolean;
                autoResendUnfulfilledCommands: boolean;
                tls: {};
            };
            cluster: {
                enableReadyCheck: boolean;
                retryDelayOnClusterDown: number;
                retryDelayOnFailover: number;
                retryDelayOnTryAgain: number;
                slotsRefreshTimeout: number;
                clusterRetryStrategy: (times: number) => number;
                dnsLookup: (address: string, callback: any) => any;
            };
        };
        redlockSettings: {
            driftFactor: number;
            retryCount: number;
            retryDelay: number;
            retryJitter: number;
        };
        jobs: {
            intentJobConfig: {
                removeOnComplete: boolean;
                removeOnFail: boolean;
                attempts: number;
                backoff: {
                    type: string;
                    delay: number;
                };
            };
            watchJobConfig: {
                removeOnComplete: boolean;
                removeOnFail: boolean;
                attempts: number;
                backoff: {
                    type: string;
                    delay: number;
                };
            };
        };
    };
    intervals: {
        retryInfeasableIntents: {
            repeatOpts: {
                every: number;
            };
            jobTemplate: {
                name: string;
                data: {};
            };
        };
        defaults: {
            repeatOpts: {
                every: number;
            };
            jobTemplate: {
                name: string;
                data: {};
                opts: {
                    removeOnComplete: boolean;
                    removeOnFail: boolean;
                    attempts: number;
                    backoff: {
                        type: string;
                        delay: number;
                    };
                };
            };
        };
    };
    quotesConfig: {
        intentExecutionTypes: string[];
    };
    gaslessIntentdAppIDs: string[];
    intentConfigs: {
        defaultFee: {
            limit: {
                tokenBase6: bigint;
                nativeBase18: bigint;
            };
            algorithm: string;
            constants: {
                token: {
                    baseFee: bigint;
                    tranche: {
                        unitFee: bigint;
                        unitSize: bigint;
                    };
                };
                native: {
                    baseFee: bigint;
                    tranche: {
                        unitFee: bigint;
                        unitSize: bigint;
                    };
                };
            };
        };
        proofs: {
            hyperlane_duration_seconds: number;
            metalayer_duration_seconds: number;
        };
        intentFundedRetries: number;
        intentFundedRetryDelayMs: number;
        defaultGasOverhead: number;
    };
    whitelist: {};
    fulfillmentEstimate: {
        executionPaddingSeconds: number;
        blockTimePercentile: number;
        defaultBlockTime: number;
    };
    gasEstimations: {
        fundFor: bigint;
        permit: bigint;
        permit2: bigint;
        defaultGasPriceGwei: string;
    };
    indexer: {
        url: string;
    };
    withdraws: {
        chunkSize: number;
        intervalDuration: number;
    };
    sendBatch: {
        chunkSize: number;
        intervalDuration: number;
        defaultGasPerIntent: number;
    };
    CCTP: {
        apiUrl: string;
        chains: {
            chainId: number;
            domain: number;
            token: string;
            tokenMessenger: string;
            messageTransmitter: string;
        }[];
    };
    CCTPV2: {
        apiUrl: string;
        chains: {
            chainId: number;
            domain: number;
            token: string;
            tokenMessenger: string;
            messageTransmitter: string;
        }[];
    };
    hyperlane: {
        useHyperlaneDefaultHook: boolean;
    };
    externalAPIs: {};
    logger: {
        usePino: boolean;
        pinoConfig: {
            pinoHttp: {
                level: string;
                useLevelLabels: boolean;
                redact: {
                    paths: string[];
                    remove: boolean;
                };
            };
        };
    };
    squid: {
        baseUrl: string;
    };
    everclear: {
        baseUrl: string;
    };
};
export default _default;
