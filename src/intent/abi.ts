export const RewardStruct = [
  {
    internalType: 'uint64',
    name: 'deadline',
    type: 'uint64',
  },
  {
    internalType: 'address',
    name: 'creator',
    type: 'address',
  },
  {
    internalType: 'address',
    name: 'prover',
    type: 'address',
  },
  {
    internalType: 'uint256',
    name: 'nativeValue',
    type: 'uint256',
  },
  {
    components: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    internalType: 'struct TokenAmount[]',
    name: 'tokens',
    type: 'tuple[]',
  },
]

export const RouteStruct = [
  {
    internalType: 'bytes32',
    name: 'salt',
    type: 'bytes32',
  },
  {
    internalType: 'uint64',
    name: 'deadline',
    type: 'uint64',
  },
  {
    internalType: 'address',
    name: 'portal',
    type: 'address',
  },
  {
    components: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    internalType: 'struct TokenAmount[]',
    name: 'tokens',
    type: 'tuple[]',
  },
  {
    components: [
      {
        internalType: 'address',
        name: 'target',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    internalType: 'struct Call[]',
    name: 'calls',
    type: 'tuple[]',
  },
]
