/*
 * Extracted Permit2 ABI for single permit2 transfer
 */
export const Permit2SinglePermitAbi = [
  {
    name: 'permitTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

/*
 * Extracted Permit2 ABI for batch permit2 transfer
 */
export const Permit2BatchPermitAbi = [
  {
    name: 'permitTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple[]',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

/*
 * Arg type for single permit2 transfer
 */
export interface PermitArgSingle {
  permitted: {
    token: `0x${string}`
    amount: bigint
  }
  nonce: bigint
  deadline: bigint
}

/*
 * Arg type for batch permit2 transfer
 */
export interface PermitArgBatch {
  permitted: {
    token: `0x${string}`
    amount: bigint
  }[]
  nonce: bigint
  deadline: bigint
}
