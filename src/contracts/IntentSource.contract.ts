import { ContractFunctionReturnType, decodeEventLog, Hex, Log } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from 'alchemy-sdk'

// Need to define the ABI as a const array to use in the type definition
export const IntentSourceAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_minimumDuration',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_counterStart',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'CalldataMismatch',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ExpiryTooSoon',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
    ],
    name: 'NothingToWithdraw',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RewardsMismatch',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
    ],
    name: 'UnauthorizedWithdrawal',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'address',
        name: '_creator',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: '_destinationChain',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address[]',
        name: '_targets',
        type: 'address[]',
      },
      {
        indexed: false,
        internalType: 'bytes[]',
        name: '_data',
        type: 'bytes[]',
      },
      {
        indexed: false,
        internalType: 'address[]',
        name: '_rewardTokens',
        type: 'address[]',
      },
      {
        indexed: false,
        internalType: 'uint256[]',
        name: '_rewardAmounts',
        type: 'uint256[]',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: '_expiryTime',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'nonce',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'address',
        name: '_prover',
        type: 'address',
      },
    ],
    name: 'IntentCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'Withdrawal',
    type: 'event',
  },
  {
    inputs: [],
    name: 'CHAIN_ID',
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
    name: 'MINIMUM_DURATION',
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
    name: 'counter',
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
    inputs: [
      {
        internalType: 'uint256',
        name: '_destinationChainID',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_inbox',
        type: 'address',
      },
      {
        internalType: 'address[]',
        name: '_targets',
        type: 'address[]',
      },
      {
        internalType: 'bytes[]',
        name: '_data',
        type: 'bytes[]',
      },
      {
        internalType: 'address[]',
        name: '_rewardTokens',
        type: 'address[]',
      },
      {
        internalType: 'uint256[]',
        name: '_rewardAmounts',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256',
        name: '_expiryTime',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_prover',
        type: 'address',
      },
    ],
    name: 'createIntent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'identifier',
        type: 'bytes32',
      },
    ],
    name: 'getIntent',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'destinationChainID',
            type: 'uint256',
          },
          {
            internalType: 'address[]',
            name: 'targets',
            type: 'address[]',
          },
          {
            internalType: 'bytes[]',
            name: 'data',
            type: 'bytes[]',
          },
          {
            internalType: 'address[]',
            name: 'rewardTokens',
            type: 'address[]',
          },
          {
            internalType: 'uint256[]',
            name: 'rewardAmounts',
            type: 'uint256[]',
          },
          {
            internalType: 'uint256',
            name: 'expiryTime',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'hasBeenWithdrawn',
            type: 'bool',
          },
          {
            internalType: 'bytes32',
            name: 'nonce',
            type: 'bytes32',
          },
          {
            internalType: 'address',
            name: 'prover',
            type: 'address',
          },
        ],
        internalType: 'struct Intent',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'intenthash',
        type: 'bytes32',
      },
    ],
    name: 'intents',
    outputs: [
      {
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'destinationChainID',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'expiryTime',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'hasBeenWithdrawn',
        type: 'bool',
      },
      {
        internalType: 'bytes32',
        name: 'nonce',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'prover',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
    ],
    name: 'withdrawRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Define the type for the contract
export type IntentSource = typeof IntentSourceAbi

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type SourceIntentViemType = ContractFunctionReturnType<
  IntentSource,
  'pure' | 'view',
  'getIntent',
  [Hex]
> & { hash: Hex; logIndex: number }

// Define the type for the IntentCreated event log
export type IntentCreatedLog = Log<
  bigint,
  number,
  false,
  ExtractAbiEvent<typeof IntentSourceAbi, 'IntentCreated'>,
  true
> & { sourceNetwork: Network; sourceChainID: bigint }

export function decodeCreateIntentLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IntentSourceAbi,
    eventName: 'IntentCreated',
    topics,
    data,
  })
}