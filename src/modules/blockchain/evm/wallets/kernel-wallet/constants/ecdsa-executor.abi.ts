/**
 * ECDSA Executor ABI
 *
 * This ABI was completely rewritten in PR #326 and requires verification against deployed contracts.
 *
 * VERIFICATION REQUIRED:
 * 1. Obtain deployed contract addresses from network configurations
 * 2. Fetch verified ABIs from block explorers (Etherscan, etc.)
 * 3. Compare function signatures, especially the 'execute' function with bytes32 mode parameter
 * 4. Update this comment with verification details once confirmed
 *
 * Expected deployments:
 * - Mainnet: TBD (verify against EVM_NETWORKS_X_CONTRACTS_ECDSA_EXECUTOR config)
 * - Testnets: TBD (verify against respective network configs)
 *
 * Last modified: PR #326
 * Verification status: PENDING
 */
export const ecdsaExecutorAbi = [
  {
    inputs: [{ internalType: 'address', name: 'smartAccount', type: 'address' }],
    name: 'AlreadyInitialized',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint256', name: 'expected', type: 'uint256' },
      { internalType: 'uint256', name: 'actual', type: 'uint256' },
    ],
    name: 'InvalidNonce',
    type: 'error',
  },
  { inputs: [], name: 'InvalidOwner', type: 'error' },
  { inputs: [], name: 'InvalidSignature', type: 'error' },
  {
    inputs: [{ internalType: 'address', name: 'smartAccount', type: 'address' }],
    name: 'NotInitialized',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint256', name: 'expiration', type: 'uint256' },
    ],
    name: 'SignatureExpired',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'kernel', type: 'address' },
      { indexed: true, internalType: 'bytes32', name: 'executionHash', type: 'bytes32' },
    ],
    name: 'ExecutionRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'kernel', type: 'address' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
    ],
    name: 'OwnerRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'kernel', type: 'address' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
    ],
    name: 'OwnerUnregistered',
    type: 'event',
  },
  {
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { internalType: 'bytes1', name: 'fields', type: 'bytes1' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'version', type: 'string' },
      { internalType: 'uint256', name: 'chainId', type: 'uint256' },
      { internalType: 'address', name: 'verifyingContract', type: 'address' },
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
      { internalType: 'uint256[]', name: 'extensions', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'ExecMode', name: 'mode', type: 'bytes32' },
      { internalType: 'bytes', name: 'executionCalldata', type: 'bytes' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'uint256', name: 'expiration', type: 'uint256' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
    ],
    name: 'execute',
    outputs: [{ internalType: 'bytes[]', name: 'returnData', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint192', name: 'key', type: 'uint192' },
    ],
    name: 'getNonce',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'getOwner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint192', name: 'key', type: 'uint192' }],
    name: 'incrementNonce',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'smartAccount', type: 'address' }],
    name: 'isInitialized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'typeID', type: 'uint256' }],
    name: 'isModuleType',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: '_data', type: 'bytes' }],
    name: 'onInstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
