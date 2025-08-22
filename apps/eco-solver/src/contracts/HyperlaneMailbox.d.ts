export declare const HyperlaneMailboxAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "_localDomain";
        readonly type: "uint32";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "constructor";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "hook";
        readonly type: "address";
    }];
    readonly name: "DefaultHookSet";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "module";
        readonly type: "address";
    }];
    readonly name: "DefaultIsmSet";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "sender";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly internalType: "uint32";
        readonly name: "destination";
        readonly type: "uint32";
    }, {
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "recipient";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly internalType: "bytes";
        readonly name: "message";
        readonly type: "bytes";
    }];
    readonly name: "Dispatch";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "messageId";
        readonly type: "bytes32";
    }];
    readonly name: "DispatchId";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: false;
        readonly internalType: "uint8";
        readonly name: "version";
        readonly type: "uint8";
    }];
    readonly name: "Initialized";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "previousOwner";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "newOwner";
        readonly type: "address";
    }];
    readonly name: "OwnershipTransferred";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "uint32";
        readonly name: "origin";
        readonly type: "uint32";
    }, {
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "sender";
        readonly type: "bytes32";
    }, {
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "recipient";
        readonly type: "address";
    }];
    readonly name: "Process";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "bytes32";
        readonly name: "messageId";
        readonly type: "bytes32";
    }];
    readonly name: "ProcessId";
    readonly type: "event";
}, {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly internalType: "address";
        readonly name: "hook";
        readonly type: "address";
    }];
    readonly name: "RequiredHookSet";
    readonly type: "event";
}, {
    readonly inputs: readonly [];
    readonly name: "VERSION";
    readonly outputs: readonly [{
        readonly internalType: "uint8";
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "defaultHook";
    readonly outputs: readonly [{
        readonly internalType: "contract IPostDispatchHook";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "defaultIsm";
    readonly outputs: readonly [{
        readonly internalType: "contract IInterchainSecurityModule";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "_id";
        readonly type: "bytes32";
    }];
    readonly name: "delivered";
    readonly outputs: readonly [{
        readonly internalType: "bool";
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "deployedBlock";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "recipientAddress";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "messageBody";
        readonly type: "bytes";
    }, {
        readonly internalType: "bytes";
        readonly name: "metadata";
        readonly type: "bytes";
    }, {
        readonly internalType: "contract IPostDispatchHook";
        readonly name: "hook";
        readonly type: "address";
    }];
    readonly name: "dispatch";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "payable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "recipientAddress";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "messageBody";
        readonly type: "bytes";
    }, {
        readonly internalType: "bytes";
        readonly name: "hookMetadata";
        readonly type: "bytes";
    }];
    readonly name: "dispatch";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "payable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "_destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "_recipientAddress";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "_messageBody";
        readonly type: "bytes";
    }];
    readonly name: "dispatch";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "payable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "_owner";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "_defaultIsm";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "_defaultHook";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "_requiredHook";
        readonly type: "address";
    }];
    readonly name: "initialize";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "latestDispatchedId";
    readonly outputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "";
        readonly type: "bytes32";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "localDomain";
    readonly outputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "";
        readonly type: "uint32";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "nonce";
    readonly outputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "";
        readonly type: "uint32";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "owner";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes";
        readonly name: "_metadata";
        readonly type: "bytes";
    }, {
        readonly internalType: "bytes";
        readonly name: "_message";
        readonly type: "bytes";
    }];
    readonly name: "process";
    readonly outputs: readonly [];
    readonly stateMutability: "payable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "_id";
        readonly type: "bytes32";
    }];
    readonly name: "processedAt";
    readonly outputs: readonly [{
        readonly internalType: "uint48";
        readonly name: "";
        readonly type: "uint48";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "bytes32";
        readonly name: "_id";
        readonly type: "bytes32";
    }];
    readonly name: "processor";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "recipientAddress";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "messageBody";
        readonly type: "bytes";
    }, {
        readonly internalType: "bytes";
        readonly name: "metadata";
        readonly type: "bytes";
    }, {
        readonly internalType: "contract IPostDispatchHook";
        readonly name: "hook";
        readonly type: "address";
    }];
    readonly name: "quoteDispatch";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "fee";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "recipientAddress";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "messageBody";
        readonly type: "bytes";
    }];
    readonly name: "quoteDispatch";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "fee";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "destinationDomain";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "recipientAddress";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "messageBody";
        readonly type: "bytes";
    }, {
        readonly internalType: "bytes";
        readonly name: "defaultHookMetadata";
        readonly type: "bytes";
    }];
    readonly name: "quoteDispatch";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "fee";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "_recipient";
        readonly type: "address";
    }];
    readonly name: "recipientIsm";
    readonly outputs: readonly [{
        readonly internalType: "contract IInterchainSecurityModule";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "renounceOwnership";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [];
    readonly name: "requiredHook";
    readonly outputs: readonly [{
        readonly internalType: "contract IPostDispatchHook";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "_hook";
        readonly type: "address";
    }];
    readonly name: "setDefaultHook";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "_module";
        readonly type: "address";
    }];
    readonly name: "setDefaultIsm";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "_hook";
        readonly type: "address";
    }];
    readonly name: "setRequiredHook";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "newOwner";
        readonly type: "address";
    }];
    readonly name: "transferOwnership";
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
export declare const MessageRecipientAbi: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "uint32";
        readonly name: "origin";
        readonly type: "uint32";
    }, {
        readonly internalType: "bytes32";
        readonly name: "sender";
        readonly type: "bytes32";
    }, {
        readonly internalType: "bytes";
        readonly name: "messageBody";
        readonly type: "bytes";
    }];
    readonly name: "handle";
    readonly outputs: readonly [];
    readonly stateMutability: "payable";
    readonly type: "function";
}];
