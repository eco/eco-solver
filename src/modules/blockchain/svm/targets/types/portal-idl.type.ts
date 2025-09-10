import { IdlTypes } from '@coral-xyz/anchor';

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/portal.json`.
 */
export type PortalIdl = {
  address: '5nCJDkRg8mhj9XHkjuFoR6Mcs6VcDZVsCbZ7pTJhRFEF';
  metadata: {
    name: 'portal';
    version: '0.1.0';
    spec: '0.1.0';
    description: 'Created with Anchor';
  };
  instructions: [
    {
      name: 'fulfill';
      discriminator: [143, 2, 52, 206, 174, 164, 247, 72];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'solver';
          writable: true;
          signer: true;
        },
        {
          name: 'executor';
        },
        {
          name: 'fulfillMarker';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'token2022Program';
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'fulfillArgs';
            };
          };
        },
      ];
    },
    {
      name: 'fund';
      discriminator: [218, 188, 111, 221, 152, 113, 174, 7];
      accounts: [
        {
          name: 'payer';
          signer: true;
        },
        {
          name: 'funder';
          writable: true;
          signer: true;
        },
        {
          name: 'vault';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'token2022Program';
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'fundArgs';
            };
          };
        },
      ];
    },
    {
      name: 'prove';
      discriminator: [52, 246, 26, 161, 211, 170, 86, 215];
      accounts: [
        {
          name: 'prover';
        },
        {
          name: 'dispatcher';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'proveArgs';
            };
          };
        },
      ];
    },
    {
      name: 'publish';
      discriminator: [129, 177, 182, 160, 184, 224, 219, 5];
      accounts: [];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'publishArgs';
            };
          };
        },
      ];
    },
    {
      name: 'refund';
      discriminator: [2, 96, 183, 251, 63, 208, 46, 46];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'creator';
          writable: true;
        },
        {
          name: 'vault';
          writable: true;
        },
        {
          name: 'proof';
        },
        {
          name: 'withdrawnMarker';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'token2022Program';
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'refundArgs';
            };
          };
        },
      ];
    },
    {
      name: 'withdraw';
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'claimant';
          writable: true;
        },
        {
          name: 'vault';
          writable: true;
        },
        {
          name: 'proof';
          writable: true;
        },
        {
          name: 'proofCloser';
        },
        {
          name: 'prover';
        },
        {
          name: 'withdrawnMarker';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'token2022Program';
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'withdrawArgs';
            };
          };
        },
      ];
    },
  ];
  events: [
    {
      name: 'intentFulfilled';
      discriminator: [168, 116, 104, 206, 0, 206, 46, 195];
    },
    {
      name: 'intentFunded';
      discriminator: [14, 106, 10, 45, 124, 28, 211, 173];
    },
    {
      name: 'intentProven';
      discriminator: [149, 170, 177, 57, 59, 144, 49, 23];
    },
    {
      name: 'intentPublished';
      discriminator: [194, 169, 103, 197, 21, 235, 236, 166];
    },
    {
      name: 'intentRefunded';
      discriminator: [192, 129, 4, 158, 184, 25, 83, 113];
    },
    {
      name: 'intentWithdrawn';
      discriminator: [28, 22, 16, 41, 101, 254, 123, 228];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'invalidCreator';
    },
    {
      code: 6001;
      name: 'invalidVault';
    },
    {
      code: 6002;
      name: 'invalidAta';
    },
    {
      code: 6003;
      name: 'invalidMint';
    },
    {
      code: 6004;
      name: 'invalidTokenProgram';
    },
    {
      code: 6005;
      name: 'insufficientFunds';
    },
    {
      code: 6006;
      name: 'invalidTokenTransferAccounts';
    },
    {
      code: 6007;
      name: 'tokenAmountOverflow';
    },
    {
      code: 6008;
      name: 'rewardNotExpired';
    },
    {
      code: 6009;
      name: 'routeExpired';
    },
    {
      code: 6010;
      name: 'invalidProof';
    },
    {
      code: 6011;
      name: 'intentFulfilledAndNotWithdrawn';
    },
    {
      code: 6012;
      name: 'intentAlreadyWithdrawn';
    },
    {
      code: 6013;
      name: 'intentAlreadyFulfilled';
    },
    {
      code: 6014;
      name: 'intentNotFulfilled';
    },
    {
      code: 6015;
      name: 'invalidCreatorToken';
    },
    {
      code: 6016;
      name: 'invalidClaimantToken';
    },
    {
      code: 6017;
      name: 'invalidWithdrawnMarker';
    },
    {
      code: 6018;
      name: 'invalidExecutor';
    },
    {
      code: 6019;
      name: 'invalidCalldata';
    },
    {
      code: 6020;
      name: 'invalidFulfillMarker';
    },
    {
      code: 6021;
      name: 'invalidPortal';
    },
    {
      code: 6022;
      name: 'invalidProver';
    },
    {
      code: 6023;
      name: 'invalidDispatcher';
    },
    {
      code: 6024;
      name: 'invalidProofCloser';
    },
    {
      code: 6025;
      name: 'invalidIntentHash';
    },
    {
      code: 6026;
      name: 'emptyIntentHashes';
    },
  ];
  types: [
    {
      name: 'bytes32';
      type: {
        kind: 'struct';
        fields: [
          {
            array: ['u8', 32];
          },
        ];
      };
    },
    {
      name: 'call';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'target';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'data';
            type: 'bytes';
          },
        ];
      };
    },
    {
      name: 'fulfillArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'route';
            type: {
              defined: {
                name: 'route';
              };
            };
          },
          {
            name: 'rewardHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'claimant';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
        ];
      };
    },
    {
      name: 'fundArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'routeHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'reward';
            type: {
              defined: {
                name: 'reward';
              };
            };
          },
          {
            name: 'allowPartial';
            type: 'bool';
          },
        ];
      };
    },
    {
      name: 'intentFulfilled';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'claimant';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
        ];
      };
    },
    {
      name: 'intentFunded';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'funder';
            type: 'pubkey';
          },
          {
            name: 'complete';
            type: 'bool';
          },
        ];
      };
    },
    {
      name: 'intentProven';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'claimant';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
        ];
      };
    },
    {
      name: 'intentPublished';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'route';
            type: 'bytes';
          },
          {
            name: 'reward';
            type: {
              defined: {
                name: 'reward';
              };
            };
          },
        ];
      };
    },
    {
      name: 'intentRefunded';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'refundee';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'intentWithdrawn';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'intentHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'claimant';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'proveArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'prover';
            type: 'pubkey';
          },
          {
            name: 'sourceChainDomainId';
            type: 'u64';
          },
          {
            name: 'intentHashes';
            type: {
              vec: {
                defined: {
                  name: 'bytes32';
                };
              };
            };
          },
          {
            name: 'data';
            type: 'bytes';
          },
        ];
      };
    },
    {
      name: 'publishArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'route';
            type: 'bytes';
          },
          {
            name: 'reward';
            type: {
              defined: {
                name: 'reward';
              };
            };
          },
        ];
      };
    },
    {
      name: 'refundArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'routeHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'reward';
            type: {
              defined: {
                name: 'reward';
              };
            };
          },
        ];
      };
    },
    {
      name: 'reward';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'deadline';
            type: 'u64';
          },
          {
            name: 'creator';
            type: 'pubkey';
          },
          {
            name: 'prover';
            type: 'pubkey';
          },
          {
            name: 'nativeAmount';
            type: 'u64';
          },
          {
            name: 'tokens';
            type: {
              vec: {
                defined: {
                  name: 'tokenAmount';
                };
              };
            };
          },
        ];
      };
    },
    {
      name: 'route';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'salt';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'deadline';
            type: 'u64';
          },
          {
            name: 'portal';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'nativeAmount';
            type: 'u64';
          },
          {
            name: 'tokens';
            type: {
              vec: {
                defined: {
                  name: 'tokenAmount';
                };
              };
            };
          },
          {
            name: 'calls';
            type: {
              vec: {
                defined: {
                  name: 'call';
                };
              };
            };
          },
        ];
      };
    },
    {
      name: 'tokenAmount';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'token';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'withdrawArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'routeHash';
            type: {
              defined: {
                name: 'bytes32';
              };
            };
          },
          {
            name: 'reward';
            type: {
              defined: {
                name: 'reward';
              };
            };
          },
        ];
      };
    },
  ];
};

export type RouteInstruction = IdlTypes<PortalIdl>['route'];
export type RewardInstruction = IdlTypes<PortalIdl>['reward'];
