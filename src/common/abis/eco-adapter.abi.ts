export const ecoAdapterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'router',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'portal',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'compact',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'addressBook',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'ecoHandler',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ADAPTER_TAG',
    inputs: [],
    outputs: [
      {
        name: 'adapterTag',
        type: 'bytes12',
        internalType: 'bytes12',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'ARBITER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EXECUTOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IIntentExecutor',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MULTICALL_HANDLER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMulticallHandler',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'PORTAL',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPortal',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: '_ROUTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eco_compact_handleClaim',
    inputs: [
      {
        name: 'claimData',
        type: 'tuple',
        internalType: 'struct EcoAdapter.CompactClaimData',
        components: [
          {
            name: 'predictedVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'order',
            type: 'tuple',
            internalType: 'struct Types.Order',
            components: [
              {
                name: 'sponsor',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'recipient',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'nonce',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'expires',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'fillDeadline',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'notarizedChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'targetChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'tokenIn',
                type: 'uint256[2][]',
                internalType: 'uint256[2][]',
              },
              {
                name: 'tokenOut',
                type: 'uint256[2][]',
                internalType: 'uint256[2][]',
              },
              {
                name: 'packedGasValues',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'preClaimOps',
                type: 'tuple',
                internalType: 'struct Types.Operation',
                components: [
                  {
                    name: 'data',
                    type: 'bytes',
                    internalType: 'bytes',
                  },
                ],
              },
              {
                name: 'targetOps',
                type: 'tuple',
                internalType: 'struct Types.Operation',
                components: [
                  {
                    name: 'data',
                    type: 'bytes',
                    internalType: 'bytes',
                  },
                ],
              },
              {
                name: 'qualifier',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'userSigs',
            type: 'tuple',
            internalType: 'struct Types.Signatures',
            components: [
              {
                name: 'notarizedClaimSig',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'preClaimSig',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'elementIndex',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'otherElements',
            type: 'bytes32[]',
            internalType: 'bytes32[]',
          },
          {
            name: 'allocatorData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eco_handleFill',
    inputs: [
      {
        name: 'fillData',
        type: 'tuple',
        internalType: 'struct EcoAdapter.FillData',
        components: [
          {
            name: 'route',
            type: 'tuple',
            internalType: 'struct Route',
            components: [
              {
                name: 'salt',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'portal',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'nativeAmount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'tokens',
                type: 'tuple[]',
                internalType: 'struct TokenAmount[]',
                components: [
                  {
                    name: 'token',
                    type: 'address',
                    internalType: 'address',
                  },
                  {
                    name: 'amount',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
              },
              {
                name: 'calls',
                type: 'tuple[]',
                internalType: 'struct Call[]',
                components: [
                  {
                    name: 'target',
                    type: 'address',
                    internalType: 'address',
                  },
                  {
                    name: 'data',
                    type: 'bytes',
                    internalType: 'bytes',
                  },
                  {
                    name: 'value',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'rewardHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'expectedIntentHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'eco_permit2_handleClaim',
    inputs: [
      {
        name: 'claimData',
        type: 'tuple',
        internalType: 'struct EcoAdapter.Permit2ClaimData',
        components: [
          {
            name: 'predictedVault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'order',
            type: 'tuple',
            internalType: 'struct Types.Order',
            components: [
              {
                name: 'sponsor',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'recipient',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'nonce',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'expires',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'fillDeadline',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'notarizedChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'targetChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'tokenIn',
                type: 'uint256[2][]',
                internalType: 'uint256[2][]',
              },
              {
                name: 'tokenOut',
                type: 'uint256[2][]',
                internalType: 'uint256[2][]',
              },
              {
                name: 'packedGasValues',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'preClaimOps',
                type: 'tuple',
                internalType: 'struct Types.Operation',
                components: [
                  {
                    name: 'data',
                    type: 'bytes',
                    internalType: 'bytes',
                  },
                ],
              },
              {
                name: 'targetOps',
                type: 'tuple',
                internalType: 'struct Types.Operation',
                components: [
                  {
                    name: 'data',
                    type: 'bytes',
                    internalType: 'bytes',
                  },
                ],
              },
              {
                name: 'qualifier',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'userSigs',
            type: 'tuple',
            internalType: 'struct Types.Signatures',
            components: [
              {
                name: 'notarizedClaimSig',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'preClaimSig',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eco_permit2_handleClaim_optimized',
    inputs: [
      {
        name: 'encodedArbiterParams',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'handleCompact_ExogenousChain',
    inputs: [
      {
        name: 'predictedVault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct Types.Order',
        components: [
          {
            name: 'sponsor',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'expires',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'fillDeadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'notarizedChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'targetChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'tokenIn',
            type: 'uint256[2][]',
            internalType: 'uint256[2][]',
          },
          {
            name: 'tokenOut',
            type: 'uint256[2][]',
            internalType: 'uint256[2][]',
          },
          {
            name: 'packedGasValues',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'preClaimOps',
            type: 'tuple',
            internalType: 'struct Types.Operation',
            components: [
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'targetOps',
            type: 'tuple',
            internalType: 'struct Types.Operation',
            components: [
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'qualifier',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'sigs',
        type: 'tuple',
        internalType: 'struct Types.Signatures',
        components: [
          {
            name: 'notarizedClaimSig',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'preClaimSig',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'otherElements',
        type: 'bytes32[]',
        internalType: 'bytes32[]',
      },
      {
        name: 'elementIndex',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'allocatorData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'claimHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'handleCompact_NotarizedChain',
    inputs: [
      {
        name: 'predictedVault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct Types.Order',
        components: [
          {
            name: 'sponsor',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'expires',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'fillDeadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'notarizedChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'targetChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'tokenIn',
            type: 'uint256[2][]',
            internalType: 'uint256[2][]',
          },
          {
            name: 'tokenOut',
            type: 'uint256[2][]',
            internalType: 'uint256[2][]',
          },
          {
            name: 'packedGasValues',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'preClaimOps',
            type: 'tuple',
            internalType: 'struct Types.Operation',
            components: [
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'targetOps',
            type: 'tuple',
            internalType: 'struct Types.Operation',
            components: [
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'qualifier',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'sigs',
        type: 'tuple',
        internalType: 'struct Types.Signatures',
        components: [
          {
            name: 'notarizedClaimSig',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'preClaimSig',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'otherElements',
        type: 'bytes32[]',
        internalType: 'bytes32[]',
      },
      {
        name: 'allocatorData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'claimHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'handlePermit2',
    inputs: [
      {
        name: 'predictedVault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct Types.Order',
        components: [
          {
            name: 'sponsor',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'expires',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'fillDeadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'notarizedChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'targetChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'tokenIn',
            type: 'uint256[2][]',
            internalType: 'uint256[2][]',
          },
          {
            name: 'tokenOut',
            type: 'uint256[2][]',
            internalType: 'uint256[2][]',
          },
          {
            name: 'packedGasValues',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'preClaimOps',
            type: 'tuple',
            internalType: 'struct Types.Operation',
            components: [
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'targetOps',
            type: 'tuple',
            internalType: 'struct Types.Operation',
            components: [
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
          {
            name: 'qualifier',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'sigs',
        type: 'tuple',
        internalType: 'struct Types.Signatures',
        components: [
          {
            name: 'notarizedClaimSig',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'preClaimSig',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'nonce',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'semVer',
    inputs: [],
    outputs: [
      {
        name: 'packedVersion',
        type: 'bytes6',
        internalType: 'bytes6',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'semVerUnpacked',
    inputs: [],
    outputs: [
      {
        name: 'major',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minor',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'patch',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settlementLayerSpender',
    inputs: [],
    outputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'version',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      {
        name: 'nonce',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Filled',
    inputs: [
      {
        name: 'nonce',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PreClaimExecutionFailed',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProcessedClaim',
    inputs: [
      {
        name: 'sponsor',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'nonce',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'claimHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ClaimFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DepositToEcoFailed',
    inputs: [
      {
        name: 'claimHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'GasStipendTooLow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'IncorrectType',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidClaimData',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOrderData',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRelayerContext',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTokenIn',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MajorVersionTooLarge',
    inputs: [
      {
        name: 'major',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MinorVersionTooLarge',
    inputs: [
      {
        name: 'minor',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'OnlyDelegateCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyRouter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PatchVersionTooLarge',
    inputs: [
      {
        name: 'patch',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
] as const;
