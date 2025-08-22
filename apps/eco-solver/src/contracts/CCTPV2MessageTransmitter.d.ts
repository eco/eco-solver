export declare const CCTPV2MessageTransmitterABI: readonly [{
    readonly name: "MessageSent";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "message";
    }];
}, {
    readonly name: "receiveMessage";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "message";
    }, {
        readonly type: "bytes";
        readonly name: "attestation";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "success";
    }];
}];
