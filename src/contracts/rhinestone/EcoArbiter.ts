export const ecoArbiterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'router',
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
        name: 'orchestrator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'intentExecutor',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'claimProofOracle',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'ecoIntentSource',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CLAIMHASH_ORACLE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IClaimHashOracle',
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
    name: 'TYPEHASH_COMPACT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TYPEHASH_ELEMENT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TYPEHASH_LOCK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TYPEHASH_MANDATE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: '__QUALIFIER_EIP712Hash',
    inputs: [
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: '_hashElement',
    inputs: [
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
        name: 'arbiter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'originChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'claimProofSender',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'hash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: '_hashMandate',
    inputs: [
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
        name: 'claimProofSender',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'hash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'handleClaimExogenousChain',
    inputs: [
      {
        name: '_claimHash',
        type: 'bytes32',
        internalType: 'bytes32',
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
      {
        name: 'preClaimGasStipend',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'handleClaimNotarizedChain',
    inputs: [
      {
        name: '_claimHash',
        type: 'bytes32',
        internalType: 'bytes32',
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
      {
        name: 'preClaimGasStipend',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'isArbiter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'pure',
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
    name: 'IncorrectType',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOrderData',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyRouter',
    inputs: [],
  },
] as const
