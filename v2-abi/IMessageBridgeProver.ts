/**
 * ABI for the IMessageBridgeProver contract
 */
export const IMessageBridgeProverAbi = [
  {
    inputs: [],
    name: 'ArrayLengthMismatch',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'chainId',
        type: 'uint256',
      },
    ],
    name: 'ChainIdTooLarge',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'domainId',
        type: 'uint64',
      },
    ],
    name: 'DomainIdTooLarge',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'requiredFee',
        type: 'uint256',
      },
    ],
    name: 'InsufficientFee',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidProofMessage',
    type: 'error',
  },
  {
    inputs: [],
    name: 'MailboxCannotBeZeroAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RouterCannotBeZeroAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SenderCannotBeZeroAddress',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'sender',
        type: 'bytes32',
      },
    ],
    name: 'UnauthorizedIncomingProof',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'expected',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'actual',
        type: 'address',
      },
    ],
    name: 'UnauthorizedSender',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroDomainID',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroPortal',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'IntentAlreadyProven',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'IntentProofInvalidated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'claimant',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
    ],
    name: 'IntentProven',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes32',
        name: 'routeHash',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'rewardHash',
        type: 'bytes32',
      },
    ],
    name: 'challengeIntentProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'domainID',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'encodedProofs',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'fetchFee',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getProofType',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        internalType: 'uint64',
        name: 'sourceChainDomainID',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'encodedProofs',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'prove',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'provenIntents',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'claimant',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
        ],
        internalType: 'struct IProver.ProofData',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
] as const

/**
 * Type-safe ABI for the IMessageBridgeProver contract
 */
export type IMessageBridgeProverAbiType = typeof IMessageBridgeProverAbi

/**
 * Bytecode for the IMessageBridgeProver contract
 */
export declare const IMessageBridgeProverBytecode = '0x'

/**
 * Deployed bytecode for the IMessageBridgeProver contract
 */
export declare const IMessageBridgeProverDeployedBytecode = '0x'
