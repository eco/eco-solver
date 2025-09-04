export const IIntentSourceAbi = [
  {
    inputs: [],
    name: 'ArrayLengthMismatch',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'InsufficientFunds',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'IntentAlreadyExists',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'IntentNotClaimed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidClaimant',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'InvalidRecoverToken',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'enum IIntentSource.Status',
        name: 'status',
        type: 'uint8',
      },
    ],
    name: 'InvalidStatusForFunding',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'enum IIntentSource.Status',
        name: 'status',
        type: 'uint8',
      },
      {
        internalType: 'uint256',
        name: 'currentTime',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'deadline',
        type: 'uint256',
      },
    ],
    name: 'InvalidStatusForRefund',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'enum IIntentSource.Status',
        name: 'status',
        type: 'uint8',
      },
    ],
    name: 'InvalidStatusForWithdrawal',
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
      {
        indexed: false,
        internalType: 'address',
        name: 'funder',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'complete',
        type: 'bool',
      },
    ],
    name: 'IntentFunded',
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
        indexed: false,
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'prover',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'rewardDeadline',
        type: 'uint64',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'rewardNativeAmount',
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
        indexed: false,
        internalType: 'struct TokenAmount[]',
        name: 'rewardTokens',
        type: 'tuple[]',
      },
    ],
    name: 'IntentPublished',
    type: 'event',
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
      {
        indexed: true,
        internalType: 'address',
        name: 'refundee',
        type: 'address',
      },
    ],
    name: 'IntentRefunded',
    type: 'event',
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
      {
        indexed: true,
        internalType: 'address',
        name: 'refundee',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'IntentTokenRecovered',
    type: 'event',
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
      {
        indexed: true,
        internalType: 'address',
        name: 'claimant',
        type: 'address',
      },
    ],
    name: 'IntentWithdrawn',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint64[]',
        name: 'destinations',
        type: 'uint64[]',
      },
      {
        internalType: 'bytes32[]',
        name: 'routeHashes',
        type: 'bytes32[]',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward[]',
        name: 'rewards',
        type: 'tuple[]',
      },
    ],
    name: 'batchWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
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
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'allowPartial',
        type: 'bool',
      },
    ],
    name: 'fund',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
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
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'allowPartial',
        type: 'bool',
      },
      {
        internalType: 'address',
        name: 'fundingAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'permitContract',
        type: 'address',
      },
    ],
    name: 'fundFor',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
    ],
    name: 'getIntentHash',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
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
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
          {
            components: [
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
                internalType: 'uint256',
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Route',
            name: 'route',
            type: 'tuple',
          },
          {
            components: [
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
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Reward',
            name: 'reward',
            type: 'tuple',
          },
        ],
        internalType: 'struct Intent',
        name: 'intent',
        type: 'tuple',
      },
    ],
    name: 'getIntentHash',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
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
    stateMutability: 'pure',
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
    name: 'getRewardStatus',
    outputs: [
      {
        internalType: 'enum IIntentSource.Status',
        name: 'status',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
    ],
    name: 'intentVaultAddress',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
          {
            components: [
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
                internalType: 'uint256',
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Route',
            name: 'route',
            type: 'tuple',
          },
          {
            components: [
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
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Reward',
            name: 'reward',
            type: 'tuple',
          },
        ],
        internalType: 'struct Intent',
        name: 'intent',
        type: 'tuple',
      },
    ],
    name: 'intentVaultAddress',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
    ],
    name: 'isIntentFunded',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
          {
            components: [
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
                internalType: 'uint256',
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Route',
            name: 'route',
            type: 'tuple',
          },
          {
            components: [
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
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Reward',
            name: 'reward',
            type: 'tuple',
          },
        ],
        internalType: 'struct Intent',
        name: 'intent',
        type: 'tuple',
      },
    ],
    name: 'isIntentFunded',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
          {
            components: [
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
                internalType: 'uint256',
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Route',
            name: 'route',
            type: 'tuple',
          },
          {
            components: [
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
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Reward',
            name: 'reward',
            type: 'tuple',
          },
        ],
        internalType: 'struct Intent',
        name: 'intent',
        type: 'tuple',
      },
    ],
    name: 'publish',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'vault',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
    ],
    name: 'publish',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'vault',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'allowPartial',
        type: 'bool',
      },
    ],
    name: 'publishAndFund',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'vault',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
          {
            components: [
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
                internalType: 'uint256',
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Route',
            name: 'route',
            type: 'tuple',
          },
          {
            components: [
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
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Reward',
            name: 'reward',
            type: 'tuple',
          },
        ],
        internalType: 'struct Intent',
        name: 'intent',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'allowPartial',
        type: 'bool',
      },
    ],
    name: 'publishAndFund',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'vault',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'route',
        type: 'bytes',
      },
      {
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'allowPartial',
        type: 'bool',
      },
      {
        internalType: 'address',
        name: 'funder',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'permitContract',
        type: 'address',
      },
    ],
    name: 'publishAndFundFor',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'vault',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
          {
            components: [
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
                internalType: 'uint256',
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Route',
            name: 'route',
            type: 'tuple',
          },
          {
            components: [
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
                name: 'nativeAmount',
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
            ],
            internalType: 'struct Reward',
            name: 'reward',
            type: 'tuple',
          },
        ],
        internalType: 'struct Intent',
        name: 'intent',
        type: 'tuple',
      },
      {
        internalType: 'bool',
        name: 'allowPartial',
        type: 'bool',
      },
      {
        internalType: 'address',
        name: 'funder',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'permitContract',
        type: 'address',
      },
    ],
    name: 'publishAndFundFor',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'vault',
        type: 'address',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
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
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'recoverToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
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
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
    ],
    name: 'refund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
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
        components: [
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
            name: 'nativeAmount',
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
        ],
        internalType: 'struct Reward',
        name: 'reward',
        type: 'tuple',
      },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/**
 * Type-safe ABI for the IInbox contract
 */
export type IIntentSourceAbiType = typeof IIntentSourceAbi

/**
 * Bytecode for the IInbox contract
 */
export declare const IIntentSourceBytecode = '0x'

/**
 * Deployed bytecode for the IInbox contract
 */
export declare const IIntentSourceDeployedBytecode = '0x'
