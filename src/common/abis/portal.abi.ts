import { getAbiItem } from 'viem';

/**
 * Portal Contract ABI Definition
 *
 * The Portal contract unifies source and destination functionality,
 * supporting multiple blockchain types (EVM, SVM, TVM) through
 * chain-specific encoding mechanisms.
 */
export const portalAbi = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'GASLESS_CROSSCHAIN_ORDER_TYPEHASH',
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
    name: '_resolve',
    inputs: [
      {
        name: 'openDeadline',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'orderData',
        type: 'tuple',
        internalType: 'struct OrderData',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'route',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
          {
            name: 'routePortal',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'routeDeadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'maxSpent',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ResolvedCrossChainOrder',
        components: [
          {
            name: 'user',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'originChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'openDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'maxSpent',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'minReceived',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'fillInstructions',
            type: 'tuple[]',
            internalType: 'struct FillInstruction[]',
            components: [
              {
                name: 'destinationChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'destinationSettler',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'originData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'batchWithdraw',
    inputs: [
      {
        name: 'destinations',
        type: 'uint64[]',
        internalType: 'uint64[]',
      },
      {
        name: 'routeHashes',
        type: 'bytes32[]',
        internalType: 'bytes32[]',
      },
      {
        name: 'rewards',
        type: 'tuple[]',
        internalType: 'struct Reward[]',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimants',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'domainSeparatorV4',
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
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executor',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IExecutor',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fill',
    inputs: [
      {
        name: 'orderId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'originData',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'fillerData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'fulfill',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
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
        name: 'rewardHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'claimant',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'fulfillAndProve',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
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
        name: 'rewardHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'claimant',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'prover',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'sourceChainDomainID',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'fund',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
      {
        name: 'allowPartial',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'fundFor',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
      {
        name: 'allowPartial',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'funder',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'permitContract',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getIntentHash',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: '_routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'rewardHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getIntentHash',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'route',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'rewardHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getIntentHash',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct Intent',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
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
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'rewardHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getRewardStatus',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'status',
        type: 'uint8',
        internalType: 'enum IIntentSource.Status',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'intentVaultAddress',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'route',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
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
    name: 'intentVaultAddress',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct Intent',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
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
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
        ],
      },
    ],
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
    name: 'isIntentFunded',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct Intent',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
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
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'open',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct OnchainCrossChainOrder',
        components: [
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderDataType',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'orderData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'openFor',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct GaslessCrossChainOrder',
        components: [
          {
            name: 'originSettler',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'user',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'originChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'openDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderDataType',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'orderData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'prove',
    inputs: [
      {
        name: 'prover',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'sourceChainDomainID',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'intentHashes',
        type: 'bytes32[]',
        internalType: 'bytes32[]',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'publish',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct Intent',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
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
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'publish',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'route',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'publishAndFund',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'route',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
      {
        name: 'allowPartial',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'publishAndFund',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct Intent',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
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
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
        ],
      },
      {
        name: 'allowPartial',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'publishAndFundFor',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'route',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
      {
        name: 'allowPartial',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'funder',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'permitContract',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'publishAndFundFor',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct Intent',
        components: [
          {
            name: 'destination',
            type: 'uint64',
            internalType: 'uint64',
          },
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
            name: 'reward',
            type: 'tuple',
            internalType: 'struct Reward',
            components: [
              {
                name: 'deadline',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'creator',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'prover',
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
            ],
          },
        ],
      },
      {
        name: 'allowPartial',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'funder',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'permitContract',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'recoverToken',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'refund',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolve',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct OnchainCrossChainOrder',
        components: [
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderDataType',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'orderData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ResolvedCrossChainOrder',
        components: [
          {
            name: 'user',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'originChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'openDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'maxSpent',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'minReceived',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'fillInstructions',
            type: 'tuple[]',
            internalType: 'struct FillInstruction[]',
            components: [
              {
                name: 'destinationChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'destinationSettler',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'originData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resolveFor',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        internalType: 'struct GaslessCrossChainOrder',
        components: [
          {
            name: 'originSettler',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'user',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'originChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'openDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderDataType',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'orderData',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ResolvedCrossChainOrder',
        components: [
          {
            name: 'user',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'originChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'openDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'maxSpent',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'minReceived',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'fillInstructions',
            type: 'tuple[]',
            internalType: 'struct FillInstruction[]',
            components: [
              {
                name: 'destinationChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'destinationSettler',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'originData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'version',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      {
        name: 'destination',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'routeHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'reward',
        type: 'tuple',
        internalType: 'struct Reward',
        components: [
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'creator',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prover',
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
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'EIP712DomainChanged',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentFulfilled',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'claimant',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentFunded',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'funder',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'complete',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentProven',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'claimant',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentPublished',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'destination',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'route',
        type: 'bytes',
        indexed: false,
        internalType: 'bytes',
      },
      {
        name: 'creator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'prover',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'rewardDeadline',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'rewardNativeAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'rewardTokens',
        type: 'tuple[]',
        indexed: false,
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
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentRefunded',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'refundee',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentTokenRecovered',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'refundee',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntentWithdrawn',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'claimant',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Open',
    inputs: [
      {
        name: 'orderId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'resolvedOrder',
        type: 'tuple',
        indexed: false,
        internalType: 'struct ResolvedCrossChainOrder',
        components: [
          {
            name: 'user',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'originChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'openDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'fillDeadline',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'orderId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'maxSpent',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'minReceived',
            type: 'tuple[]',
            internalType: 'struct Output[]',
            components: [
              {
                name: 'token',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'amount',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'recipient',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'chainId',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'fillInstructions',
            type: 'tuple[]',
            internalType: 'struct FillInstruction[]',
            components: [
              {
                name: 'destinationChainId',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'destinationSettler',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'originData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderFilled',
    inputs: [
      {
        name: 'orderId',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'solver',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AddressInsufficientBalance',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ArrayLengthMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ChainIdTooLarge',
    inputs: [
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureLength',
    inputs: [
      {
        name: 'length',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureS',
    inputs: [
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'FailedInnerCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientFunds',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientNativeAmount',
    inputs: [
      {
        name: 'sent',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'required',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientNativeRewardAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'IntentAlreadyExists',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'IntentAlreadyFulfilled',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'IntentExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'IntentNotClaimed',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'IntentNotFulfilled',
    inputs: [
      {
        name: 'intentHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidClaimant',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidHash',
    inputs: [
      {
        name: 'expectedHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidOriginChainId',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'actual',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidOriginSettler',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidPortal',
    inputs: [
      {
        name: 'portal',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidRecoverToken',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidStatusForFunding',
    inputs: [
      {
        name: 'status',
        type: 'uint8',
        internalType: 'enum IIntentSource.Status',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidStatusForRefund',
    inputs: [
      {
        name: 'status',
        type: 'uint8',
        internalType: 'enum IIntentSource.Status',
      },
      {
        name: 'currentTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidStatusForWithdrawal',
    inputs: [
      {
        name: 'status',
        type: 'uint8',
        internalType: 'enum IIntentSource.Status',
      },
    ],
  },
  {
    type: 'error',
    name: 'OpenDeadlinePassed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
  {
    type: 'error',
    name: 'TypeSignatureMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroClaimant',
    inputs: [],
  },
] as const;

/**
 * Portal ABI Item exports for type extraction
 * The actual type definitions are in intent.interface.ts and blockchain-intents.ts
 */

export const [, EVMRouteAbiItem, EVMRewardAbiItem] = getAbiItem({
  abi: portalAbi,
  name: 'isIntentFunded',
}).inputs[0].components;
