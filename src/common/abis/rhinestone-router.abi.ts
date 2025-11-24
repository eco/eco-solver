export const rhinestoneRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'atomicFillSigner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adder',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'remover',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: '$atomicFillSigner',
    inputs: [],
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
    name: 'CALLER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract Caller',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
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
    name: 'forceHotfixClaimAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'forceHotfixFillAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getClaimAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adapterTag',
        type: 'bytes12',
        internalType: 'bytes12',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFillAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adapterTag',
        type: 'bytes12',
        internalType: 'bytes12',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoleAdmin',
    inputs: [
      {
        name: 'role',
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
    name: 'grantRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
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
    name: 'hotfixClaimAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hotfixFillAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      {
        name: 'atomicSigner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'addAdmin',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'rmAdmin',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'initialized',
    inputs: [],
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
    name: 'installClaimAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'installFillAdapter',
    inputs: [
      {
        name: 'protocolVersion',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isContractDeployed',
    inputs: [
      {
        name: 'addr',
        type: 'address',
        internalType: 'address',
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
    name: 'optimized_routeFill921336808',
    inputs: [
      {
        name: 'relayerContexts',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
      {
        name: 'encodedAdapterCalldatas',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'atomicFillSignature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'pauseRouter',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'callerConfirmation',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'retireClaimAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'retireFillAdapter',
    inputs: [
      {
        name: 'version',
        type: 'bytes2',
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'routeClaim',
    inputs: [
      {
        name: 'relayerContexts',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
      {
        name: 'adapterCalldatas',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'routeClaim',
    inputs: [
      {
        name: 'relayerContext',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'adapterCalldata',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'setAtomicFillSigner',
    inputs: [
      {
        name: 'newSigner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTokenApproval',
    inputs: [
      {
        name: 'adapter',
        type: 'address',
        internalType: 'address',
      },
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
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [
      {
        name: 'interfaceId',
        type: 'bytes4',
        internalType: 'bytes4',
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
    type: 'event',
    name: 'ClaimAdapter',
    inputs: [
      {
        name: 'protocolVersion',
        type: 'bytes2',
        indexed: false,
        internalType: 'bytes2',
      },
      {
        name: 'adapter',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'selector',
        type: 'bytes4',
        indexed: false,
        internalType: 'bytes4',
      },
      {
        name: 'adapterTag',
        type: 'bytes12',
        indexed: false,
        internalType: 'bytes12',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ClaimAdapterRetired',
    inputs: [
      {
        name: 'protocolVersion',
        type: 'bytes2',
        indexed: false,
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        indexed: false,
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FillAdapter',
    inputs: [
      {
        name: 'protocolVersion',
        type: 'bytes2',
        indexed: false,
        internalType: 'bytes2',
      },
      {
        name: 'adapter',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'selector',
        type: 'bytes4',
        indexed: false,
        internalType: 'bytes4',
      },
      {
        name: 'adapterTag',
        type: 'bytes12',
        indexed: false,
        internalType: 'bytes12',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FillAdapterRetired',
    inputs: [
      {
        name: 'protocolVersion',
        type: 'bytes2',
        indexed: false,
        internalType: 'bytes2',
      },
      {
        name: 'selector',
        type: 'bytes4',
        indexed: false,
        internalType: 'bytes4',
      },
      {
        name: 'adapter',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FillSignerSet',
    inputs: [
      {
        name: 'signer',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleAdminChanged',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'previousAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'newAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleGranted',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleRevoked',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetApproval',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AccessControlBadConfirmation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'neededRole',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'AccountCreationFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AdapterAlreadyInstalled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AdapterCallFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AdapterMajorVersionMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AdapterNotFound',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AdapterNotInstalled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AtomicSignerNotSet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'CallFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAccountAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAdapter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidArbiter',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAtomicity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LengthMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyPatchAllowed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Paused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Reentrancy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SettingApprovalsNotSupported',
    inputs: [
      {
        name: 'adapter',
        type: 'address',
        internalType: 'contract IAdapter',
      },
    ],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnauthorizedInit',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnusedETH',
    inputs: [],
  },
] as const;
