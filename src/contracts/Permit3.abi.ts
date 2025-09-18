export const permit3Abi = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [{ internalType: 'uint48', name: 'deadline', type: 'uint48' }],
    name: 'AllowanceExpired',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'bytes32', name: 'tokenKey', type: 'bytes32' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'AllowanceLocked',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ECDSAInvalidSignature',
    type: 'error',
  },
  {
    inputs: [],
    name: 'EmptyArray',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroAccount',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: true, internalType: 'bytes32', name: 'tokenKey', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'spender', type: 'address' },
      { indexed: false, internalType: 'uint160', name: 'amount', type: 'uint160' },
      { indexed: false, internalType: 'uint48', name: 'expiration', type: 'uint48' },
      { indexed: false, internalType: 'uint48', name: 'timestamp', type: 'uint48' },
    ],
    name: 'PermitMultiToken',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
      { internalType: 'uint48', name: 'deadline', type: 'uint48' },
      { internalType: 'uint48', name: 'timestamp', type: 'uint48' },
      {
        components: [
          { internalType: 'uint64', name: 'chainId', type: 'uint64' },
          {
            components: [
              { internalType: 'uint48', name: 'modeOrExpiration', type: 'uint48' },
              { internalType: 'bytes32', name: 'tokenKey', type: 'bytes32' },
              { internalType: 'address', name: 'account', type: 'address' },
              { internalType: 'uint160', name: 'amountDelta', type: 'uint160' },
            ],
            internalType: 'struct IPermit3.AllowanceOrTransfer[]',
            name: 'permits',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IPermit3.ChainPermits',
        name: 'permits',
        type: 'tuple',
      },
      { internalType: 'bytes32[]', name: 'proof', type: 'bytes32[]' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint48', name: 'modeOrExpiration', type: 'uint48' },
          { internalType: 'bytes32', name: 'tokenKey', type: 'bytes32' },
          { internalType: 'address', name: 'account', type: 'address' },
          { internalType: 'uint160', name: 'amountDelta', type: 'uint160' },
        ],
        internalType: 'struct IPermit3.AllowanceOrTransfer[]',
        name: 'permits',
        type: 'tuple[]',
      },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
