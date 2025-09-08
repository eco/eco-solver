/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hyper-prover.idl.ts`.
 */
export type HyperProverIdl = {
  address: 'B4pMQaAGPZ7Mza9XnDxJfXZ1cUa4aa67zrNkv8zYAjx4';
  metadata: {
    name: 'hyperProver';
    version: '0.1.0';
    spec: '0.1.0';
    description: 'Created with Anchor';
  };
  instructions: [
    {
      name: 'closeProof';
      discriminator: [64, 76, 168, 8, 126, 109, 164, 179];
      accounts: [
        {
          name: 'portalProofCloser';
          signer: true;
        },
        {
          name: 'proof';
          writable: true;
        },
        {
          name: 'pdaPayer';
          writable: true;
        },
      ];
      args: [];
    },
    {
      name: 'handle';
      discriminator: [33, 210, 5, 66, 196, 212, 239, 142];
      accounts: [
        {
          name: 'processAuthority';
          signer: true;
        },
        {
          name: 'config';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'pdaPayer';
          writable: true;
        },
        {
          name: 'eventAuthority';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'origin';
          type: 'u32';
        },
        {
          name: 'sender';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'payload';
          type: 'bytes';
        },
      ];
    },
    {
      name: 'handleAccountMetas';
      discriminator: [194, 141, 30, 82, 241, 41, 169, 52];
      accounts: [
        {
          name: 'handleAccountMetas';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  104,
                  121,
                  112,
                  101,
                  114,
                  108,
                  97,
                  110,
                  101,
                  95,
                  109,
                  101,
                  115,
                  115,
                  97,
                  103,
                  101,
                  95,
                  114,
                  101,
                  99,
                  105,
                  112,
                  105,
                  101,
                  110,
                  116,
                ];
              },
              {
                kind: 'const';
                value: [45];
              },
              {
                kind: 'const';
                value: [104, 97, 110, 100, 108, 101];
              },
              {
                kind: 'const';
                value: [45];
              },
              {
                kind: 'const';
                value: [97, 99, 99, 111, 117, 110, 116, 95, 109, 101, 116, 97, 115];
              },
            ];
          };
        },
      ];
      args: [
        {
          name: 'origin';
          type: 'u32';
        },
        {
          name: 'sender';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'payload';
          type: 'bytes';
        },
      ];
    },
    {
      name: 'init';
      discriminator: [220, 59, 207, 236, 108, 250, 47, 100];
      accounts: [
        {
          name: 'config';
          writable: true;
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
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
              name: 'initArgs';
            };
          };
        },
      ];
    },
    {
      name: 'ism';
      discriminator: [45, 18, 245, 87, 234, 46, 246, 15];
      accounts: [];
      args: [];
    },
    {
      name: 'ismAccountMetas';
      discriminator: [190, 214, 218, 129, 67, 97, 4, 76];
      accounts: [
        {
          name: 'ismAccountMetas';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  104,
                  121,
                  112,
                  101,
                  114,
                  108,
                  97,
                  110,
                  101,
                  95,
                  109,
                  101,
                  115,
                  115,
                  97,
                  103,
                  101,
                  95,
                  114,
                  101,
                  99,
                  105,
                  112,
                  105,
                  101,
                  110,
                  116,
                ];
              },
              {
                kind: 'const';
                value: [45];
              },
              {
                kind: 'const';
                value: [
                  105,
                  110,
                  116,
                  101,
                  114,
                  99,
                  104,
                  97,
                  105,
                  110,
                  95,
                  115,
                  101,
                  99,
                  117,
                  114,
                  105,
                  116,
                  121,
                  95,
                  109,
                  111,
                  100,
                  117,
                  108,
                  101,
                ];
              },
              {
                kind: 'const';
                value: [45];
              },
              {
                kind: 'const';
                value: [97, 99, 99, 111, 117, 110, 116, 95, 109, 101, 116, 97, 115];
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: 'prove';
      discriminator: [52, 246, 26, 161, 211, 170, 86, 215];
      accounts: [
        {
          name: 'portalDispatcher';
          signer: true;
        },
        {
          name: 'dispatcher';
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'outboxPda';
          writable: true;
        },
        {
          name: 'splNoopProgram';
        },
        {
          name: 'uniqueMessage';
          signer: true;
        },
        {
          name: 'dispatchedMessagePda';
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'mailboxProgram';
          address: '75HBBLae3ddeneJVrZeyrDfv6vb7SMC3aCpBucSXS5aR';
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
  ];
  accounts: [
    {
      name: 'config';
      discriminator: [155, 12, 170, 224, 30, 250, 204, 130];
    },
    {
      name: 'proofAccount';
      discriminator: [54, 244, 192, 233, 218, 58, 44, 242];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'invalidPortalDispatcher';
    },
    {
      code: 6001;
      name: 'invalidPortalProofCloser';
    },
    {
      code: 6002;
      name: 'invalidDispatcher';
    },
    {
      code: 6003;
      name: 'invalidData';
    },
    {
      code: 6004;
      name: 'invalidMailbox';
    },
    {
      code: 6005;
      name: 'invalidDomainId';
    },
    {
      code: 6006;
      name: 'invalidProcessAuthority';
    },
    {
      code: 6007;
      name: 'invalidConfig';
    },
    {
      code: 6008;
      name: 'tooManyWhitelistedSenders';
    },
    {
      code: 6009;
      name: 'invalidSender';
    },
    {
      code: 6010;
      name: 'invalidProof';
    },
    {
      code: 6011;
      name: 'intentAlreadyProven';
    },
    {
      code: 6012;
      name: 'invalidPdaPayer';
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
      name: 'config';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'whitelistedSenders';
            type: {
              vec: {
                defined: {
                  name: 'bytes32';
                };
              };
            };
          },
        ];
      };
    },
    {
      name: 'initArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'whitelistedSenders';
            type: {
              vec: {
                defined: {
                  name: 'bytes32';
                };
              };
            };
          },
        ];
      };
    },
    {
      name: 'intentHashClaimant';
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
      name: 'proof';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'claimant';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'proofAccount';
      type: {
        kind: 'struct';
        fields: [
          {
            defined: {
              name: 'proof';
            };
          },
        ];
      };
    },
    {
      name: 'proofData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'destination';
            type: 'u64';
          },
          {
            name: 'intentHashesClaimants';
            type: {
              vec: {
                defined: {
                  name: 'intentHashClaimant';
                };
              };
            };
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
            name: 'domainId';
            type: 'u64';
          },
          {
            name: 'proofData';
            type: {
              defined: {
                name: 'proofData';
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
  ];
};
