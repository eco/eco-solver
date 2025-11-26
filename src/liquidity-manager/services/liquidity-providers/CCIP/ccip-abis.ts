import { Abi, AbiEvent } from 'viem'

const TOKEN_AMOUNT_COMPONENTS = [
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
] as const

const MESSAGE_COMPONENTS = [
  {
    name: 'receiver',
    type: 'bytes',
    internalType: 'bytes',
  },
  {
    name: 'data',
    type: 'bytes',
    internalType: 'bytes',
  },
  {
    name: 'tokenAmounts',
    type: 'tuple[]',
    internalType: 'struct Client.EVMTokenAmount[]',
    components: TOKEN_AMOUNT_COMPONENTS,
  },
  {
    name: 'feeToken',
    type: 'address',
    internalType: 'address',
  },
  {
    name: 'extraArgs',
    type: 'bytes',
    internalType: 'bytes',
  },
] as const

export const ROUTER_ABI = [
  {
    type: 'function',
    name: 'ccipSend',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'destinationChainSelector',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'message',
        type: 'tuple',
        internalType: 'struct Client.EVM2AnyMessage',
        components: MESSAGE_COMPONENTS,
      },
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getFee',
    stateMutability: 'view',
    inputs: [
      {
        name: 'destinationChainSelector',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'message',
        type: 'tuple',
        internalType: 'struct Client.EVM2AnyMessage',
        components: MESSAGE_COMPONENTS,
      },
    ],
    outputs: [
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'function',
    name: 'getOnRamp',
    stateMutability: 'view',
    inputs: [
      {
        name: 'destChainSelector',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
  },
  {
    type: 'function',
    name: 'getOffRamps',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct Router.OffRamp[]',
        components: [
          {
            name: 'sourceChainSelector',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'offRamp',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
  },
] as const satisfies Abi

export const ONRAMP_ABI_V1_5 = [
  {
    type: 'event',
    name: 'CCIPSendRequested',
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: 'message',
        type: 'tuple',
        internalType: 'struct Internal.EVM2EVMMessage',
        components: [
          { name: 'sourceChainSelector', type: 'uint64', internalType: 'uint64' },
          { name: 'sender', type: 'address', internalType: 'address' },
          { name: 'receiver', type: 'address', internalType: 'address' },
          { name: 'sequenceNumber', type: 'uint64', internalType: 'uint64' },
          { name: 'gasLimit', type: 'uint256', internalType: 'uint256' },
          { name: 'strict', type: 'bool', internalType: 'bool' },
          { name: 'nonce', type: 'uint64', internalType: 'uint64' },
          { name: 'feeToken', type: 'address', internalType: 'address' },
          { name: 'feeTokenAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'data', type: 'bytes', internalType: 'bytes' },
          {
            name: 'tokenAmounts',
            type: 'tuple[]',
            internalType: 'struct Client.EVMTokenAmount[]',
            components: TOKEN_AMOUNT_COMPONENTS,
          },
          { name: 'sourceTokenData', type: 'bytes[]', internalType: 'bytes[]' },
          { name: 'messageId', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
  },
] as const satisfies Abi

export const ONRAMP_ABI_V1_6 = [
  {
    type: 'event',
    name: 'CCIPMessageSent',
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'destChainSelector',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        indexed: true,
        name: 'sequenceNumber',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        indexed: false,
        name: 'message',
        type: 'tuple',
        internalType: 'struct Internal.EVM2AnyRampMessage',
        components: [
          {
            name: 'header',
            type: 'tuple',
            internalType: 'struct Internal.RampMessageHeader',
            components: [
              { name: 'messageId', type: 'bytes32', internalType: 'bytes32' },
              { name: 'sourceChainSelector', type: 'uint64', internalType: 'uint64' },
              { name: 'destChainSelector', type: 'uint64', internalType: 'uint64' },
              { name: 'sequenceNumber', type: 'uint64', internalType: 'uint64' },
              { name: 'nonce', type: 'uint64', internalType: 'uint64' },
            ],
          },
          { name: 'sender', type: 'address', internalType: 'address' },
          { name: 'data', type: 'bytes', internalType: 'bytes' },
          { name: 'receiver', type: 'bytes', internalType: 'bytes' },
          { name: 'extraArgs', type: 'bytes', internalType: 'bytes' },
          { name: 'feeToken', type: 'address', internalType: 'address' },
          { name: 'feeTokenAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'feeValueJuels', type: 'uint256', internalType: 'uint256' },
          {
            name: 'tokenAmounts',
            type: 'tuple[]',
            internalType: 'struct Internal.EVM2AnyTokenTransfer[]',
            components: [
              { name: 'sourcePoolAddress', type: 'address', internalType: 'address' },
              { name: 'destTokenAddress', type: 'bytes', internalType: 'bytes' },
              { name: 'extraData', type: 'bytes', internalType: 'bytes' },
              { name: 'amount', type: 'uint256', internalType: 'uint256' },
              { name: 'destExecData', type: 'bytes', internalType: 'bytes' },
            ],
          },
        ],
      },
    ],
  },
] as const satisfies Abi

export const EXECUTION_STATE_CHANGED_EVENT_V1 = {
  type: 'event',
  name: 'ExecutionStateChanged',
  inputs: [
    {
      name: 'sourceChainSelector',
      type: 'uint64',
      indexed: true,
      internalType: 'uint64',
    },
    {
      name: 'sequenceNumber',
      type: 'uint64',
      indexed: true,
      internalType: 'uint64',
    },
    {
      name: 'messageId',
      type: 'bytes32',
      indexed: true,
      internalType: 'bytes32',
    },
    {
      name: 'messageHash',
      type: 'bytes32',
      indexed: false,
      internalType: 'bytes32',
    },
    {
      name: 'state',
      type: 'uint8',
      indexed: false,
      internalType: 'enum Internal.MessageExecutionState',
    },
    {
      name: 'returnData',
      type: 'bytes',
      indexed: false,
      internalType: 'bytes',
    },
    {
      name: 'gasUsed',
      type: 'uint256',
      indexed: false,
      internalType: 'uint256',
    },
  ],
} as const satisfies AbiEvent

export const EXECUTION_STATE_CHANGED_EVENT_V2 = {
  type: 'event',
  name: 'ExecutionStateChanged',
  inputs: [
    {
      name: 'sequenceNumber',
      type: 'uint64',
      indexed: true,
      internalType: 'uint64',
    },
    {
      name: 'messageId',
      type: 'bytes32',
      indexed: true,
      internalType: 'bytes32',
    },
    {
      name: 'state',
      type: 'uint8',
      indexed: false,
      internalType: 'enum Internal.MessageExecutionState',
    },
    {
      name: 'returnData',
      type: 'bytes',
      indexed: false,
      internalType: 'bytes',
    },
  ],
} as const satisfies AbiEvent

export const TRANSFER_STATUS_FROM_BLOCK_SHIFT = 100n
