/*
 * Extracted Permit2 ABI for single permit2 transfer
 */
export const Permit2SinglePermitAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'address',
                name: 'token',
                type: 'address',
              },
              {
                internalType: 'uint160',
                name: 'amount',
                type: 'uint160',
              },
              {
                internalType: 'uint48',
                name: 'expiration',
                type: 'uint48',
              },
              {
                internalType: 'uint48',
                name: 'nonce',
                type: 'uint48',
              },
            ],
            internalType: 'struct IAllowanceTransfer.PermitDetails',
            name: 'details',
            type: 'tuple',
          },
          {
            internalType: 'address',
            name: 'spender',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'sigDeadline',
            type: 'uint256',
          },
        ],
        internalType: 'struct IAllowanceTransfer.PermitSingle',
        name: 'permitSingle',
        type: 'tuple',
      },
      {
        internalType: 'bytes',
        name: 'signature',
        type: 'bytes',
      },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/*
 * Extracted Permit2 ABI for batch permit2 transfer
 */
export const Permit2BatchPermitAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'address',
                name: 'token',
                type: 'address',
              },
              {
                internalType: 'uint160',
                name: 'amount',
                type: 'uint160',
              },
              {
                internalType: 'uint48',
                name: 'expiration',
                type: 'uint48',
              },
              {
                internalType: 'uint48',
                name: 'nonce',
                type: 'uint48',
              },
            ],
            internalType: 'struct IAllowanceTransfer.PermitDetails[]',
            name: 'details',
            type: 'tuple[]',
          },
          {
            internalType: 'address',
            name: 'spender',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'sigDeadline',
            type: 'uint256',
          },
        ],
        internalType: 'struct IAllowanceTransfer.PermitBatch',
        name: 'permitBatch',
        type: 'tuple',
      },
      {
        internalType: 'bytes',
        name: 'signature',
        type: 'bytes',
      },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/*
 * Arg type for single permit2 transfer
 */
export interface PermitSingleArg {
  details: PermitDetails
  spender: Hex
  sigDeadline: bigint
}

/*
 * Arg type for batch permit2 transfer
 */
export interface PermitBatchArg {
  details: PermitDetails[]
  spender: `0x${string}`
  sigDeadline: bigint
}

/*
 * PermitDetails type
 */
type PermitDetails = {
  token: Hex
  amount: bigint
  expiration: number
  nonce: number
}
