export declare const CCTPTokenMessengerABI: readonly [{
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
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "_nonce";
    }];
}, {
    readonly name: "depositForBurnWithCaller";
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
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "nonce";
    }];
}];
