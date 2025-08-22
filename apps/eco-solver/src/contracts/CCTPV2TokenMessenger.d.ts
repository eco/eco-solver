export declare const CCTPV2TokenMessengerABI: readonly [{
    readonly name: "depositForBurn";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint32";
        readonly name: "destinationDomain";
    }, {
        readonly type: "bytes32";
        readonly name: "mintRecipient";
    }, {
        readonly type: "address";
        readonly name: "burnToken";
    }, {
        readonly type: "bytes32";
        readonly name: "destinationCaller";
    }, {
        readonly type: "uint256";
        readonly name: "maxFee";
    }, {
        readonly type: "uint32";
        readonly name: "minFinalityThreshold";
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "nonce";
    }];
}, {
    readonly name: "depositForBurnWithHook";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint32";
        readonly name: "destinationDomain";
    }, {
        readonly type: "bytes32";
        readonly name: "mintRecipient";
    }, {
        readonly type: "address";
        readonly name: "burnToken";
    }, {
        readonly type: "bytes32";
        readonly name: "destinationCaller";
    }, {
        readonly type: "uint256";
        readonly name: "maxFee";
    }, {
        readonly type: "uint32";
        readonly name: "minFinalityThreshold";
    }, {
        readonly type: "bytes";
        readonly name: "hookData";
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "nonce";
    }];
}];
