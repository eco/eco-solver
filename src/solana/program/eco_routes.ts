/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/eco_routes.json`.
 */
export type EcoRoutes = {
  address: '3zbEiMYyf4y1bGsVBAzKrXVzMndRQdTMDgx3aKCs8BHs'
  metadata: {
    name: 'ecoRoutes'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'Created with Anchor'
  }
  instructions: [
    {
      name: 'claimIntentNative'
      discriminator: [218, 207, 63, 238, 168, 170, 137, 45]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'claimer'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'claimIntentNativeArgs'
            }
          }
        },
      ]
    },
    {
      name: 'claimIntentSpl'
      discriminator: [196, 243, 95, 202, 233, 98, 70, 77]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'sourceToken'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [114, 101, 119, 97, 114, 100]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
              {
                kind: 'account'
                path: 'mint'
              },
            ]
          }
        },
        {
          name: 'destinationToken'
          writable: true
        },
        {
          name: 'mint'
        },
        {
          name: 'claimer'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'tokenProgram'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'claimIntentSplArgs'
            }
          }
        },
      ]
    },
    {
      name: 'closeIntent'
      discriminator: [112, 245, 154, 249, 57, 126, 54, 122]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'account'
                path: 'intent.intent_hash'
                account: 'intent'
              },
            ]
          }
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'fulfillIntent'
      discriminator: [236, 191, 7, 151, 169, 132, 84, 160]
      accounts: [
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'solver'
          writable: true
          signer: true
        },
        {
          name: 'executionAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  101,
                  120,
                  101,
                  99,
                  117,
                  116,
                  105,
                  111,
                  110,
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
                ]
              },
              {
                kind: 'arg'
                path: 'args.route.salt'
              },
            ]
          }
        },
        {
          name: 'dispatchAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  100,
                  105,
                  115,
                  112,
                  97,
                  116,
                  99,
                  104,
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
                ]
              },
            ]
          }
        },
        {
          name: 'mailboxProgram'
          address: 'E588QtVUvresuXq2KoNEwAmoifCzYGpRBdHByN9KQMbi'
        },
        {
          name: 'outboxPda'
          writable: true
        },
        {
          name: 'splNoopProgram'
        },
        {
          name: 'uniqueMessage'
          writable: true
          signer: true
        },
        {
          name: 'intentFulfillmentMarker'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  105,
                  110,
                  116,
                  101,
                  110,
                  116,
                  95,
                  102,
                  117,
                  108,
                  102,
                  105,
                  108,
                  108,
                  109,
                  101,
                  110,
                  116,
                  95,
                  109,
                  97,
                  114,
                  107,
                  101,
                  114,
                ]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'dispatchedMessagePda'
          writable: true
        },
        {
          name: 'splTokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'splToken2022Program'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'fulfillIntentArgs'
            }
          }
        },
      ]
    },
    {
      name: 'fundIntentNative'
      discriminator: [252, 76, 61, 236, 123, 170, 224, 178]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'funder'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'fundIntentNativeArgs'
            }
          }
        },
      ]
    },
    {
      name: 'fundIntentSpl'
      discriminator: [224, 238, 183, 248, 172, 197, 19, 48]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'sourceToken'
          writable: true
        },
        {
          name: 'destinationToken'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [114, 101, 119, 97, 114, 100]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
              {
                kind: 'account'
                path: 'mint'
              },
            ]
          }
        },
        {
          name: 'mint'
        },
        {
          name: 'funder'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'tokenProgram'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'fundIntentSplArgs'
            }
          }
        },
      ]
    },
    {
      name: 'handle'
      discriminator: [33, 210, 5, 66, 196, 212, 239, 142]
      accounts: [
        {
          name: 'proverProcessAuthority'
          signer: true
          address: '6UX6pivzfzJKEh3Gh342fogokfaGU9HcHQUSRm4Jymed'
        },
      ]
      args: [
        {
          name: 'origin'
          type: 'u32'
        },
        {
          name: 'sender'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'payload'
          type: 'bytes'
        },
      ]
    },
    {
      name: 'handleAccountMetas'
      discriminator: [194, 141, 30, 82, 241, 41, 169, 52]
      accounts: [
        {
          name: 'handleAccountMetas'
          pda: {
            seeds: [
              {
                kind: 'const'
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
                ]
              },
              {
                kind: 'const'
                value: [45]
              },
              {
                kind: 'const'
                value: [104, 97, 110, 100, 108, 101]
              },
              {
                kind: 'const'
                value: [45]
              },
              {
                kind: 'const'
                value: [97, 99, 99, 111, 117, 110, 116, 95, 109, 101, 116, 97, 115]
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'origin'
          type: 'u32'
        },
        {
          name: 'sender'
          type: {
            array: ['u8', 32]
          }
        },
        {
          name: 'payload'
          type: 'bytes'
        },
      ]
    },
    {
      name: 'ism'
      discriminator: [45, 18, 245, 87, 234, 46, 246, 15]
      accounts: []
      args: []
    },
    {
      name: 'ismAccountMetas'
      discriminator: [190, 214, 218, 129, 67, 97, 4, 76]
      accounts: [
        {
          name: 'ismAccountMetas'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
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
                ]
              },
              {
                kind: 'const'
                value: [45]
              },
              {
                kind: 'const'
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
                ]
              },
              {
                kind: 'const'
                value: [45]
              },
              {
                kind: 'const'
                value: [97, 99, 99, 111, 117, 110, 116, 95, 109, 101, 116, 97, 115]
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'publishIntent'
      discriminator: [193, 165, 112, 34, 81, 245, 150, 193]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'creator'
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'publishIntentArgs'
            }
          }
        },
      ]
    },
    {
      name: 'refundIntentNative'
      discriminator: [209, 132, 70, 173, 31, 104, 101, 91]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'refundee'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'refundIntentNativeArgs'
            }
          }
        },
      ]
    },
    {
      name: 'refundIntentSpl'
      discriminator: [36, 63, 243, 228, 56, 60, 54, 201]
      accounts: [
        {
          name: 'intent'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [105, 110, 116, 101, 110, 116]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
            ]
          }
        },
        {
          name: 'sourceToken'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [114, 101, 119, 97, 114, 100]
              },
              {
                kind: 'arg'
                path: 'args.intent_hash'
              },
              {
                kind: 'account'
                path: 'mint'
              },
            ]
          }
        },
        {
          name: 'destinationToken'
        },
        {
          name: 'mint'
        },
        {
          name: 'refundee'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'tokenProgram'
        },
      ]
      args: [
        {
          name: 'args'
          type: {
            defined: {
              name: 'refundIntentSplArgs'
            }
          }
        },
      ]
    },
  ]
  accounts: [
    {
      name: 'intent'
      discriminator: [247, 162, 35, 165, 254, 111, 129, 109]
    },
    {
      name: 'intentFulfillmentMarker'
      discriminator: [1, 23, 123, 90, 121, 222, 119, 204]
    },
  ]
  errors: [
    {
      code: 6000
      name: 'notInFundingPhase'
    },
    {
      code: 6001
      name: 'tooManyTokens'
    },
    {
      code: 6002
      name: 'duplicateTokens'
    },
    {
      code: 6003
      name: 'tooManyCalls'
    },
    {
      code: 6004
      name: 'callDataTooLarge'
    },
    {
      code: 6005
      name: 'invalidDeadline'
    },
    {
      code: 6006
      name: 'invalidMint'
    },
    {
      code: 6007
      name: 'alreadyFunded'
    },
    {
      code: 6008
      name: 'invalidTokenIndex'
    },
    {
      code: 6009
      name: 'invalidRefundee'
    },
    {
      code: 6010
      name: 'notFunded'
    },
    {
      code: 6011
      name: 'intentNotExpired'
    },
    {
      code: 6012
      name: 'intentStillFunded'
    },
    {
      code: 6013
      name: 'invalidHandlePayload'
    },
    {
      code: 6014
      name: 'invalidSender'
    },
    {
      code: 6015
      name: 'invalidOrigin'
    },
    {
      code: 6016
      name: 'invalidAuthority'
    },
    {
      code: 6017
      name: 'tooManySenders'
    },
    {
      code: 6018
      name: 'intentNotFunded'
    },
    {
      code: 6019
      name: 'notMailbox'
    },
    {
      code: 6020
      name: 'notIgp'
    },
    {
      code: 6021
      name: 'invalidProcessAuthority'
    },
    {
      code: 6022
      name: 'invalidExecutionAuthority'
    },
    {
      code: 6023
      name: 'invalidDispatchAuthority'
    },
    {
      code: 6024
      name: 'deadlinePassed'
    },
    {
      code: 6025
      name: 'invalidClaimer'
    },
    {
      code: 6026
      name: 'notFulfilled'
    },
    {
      code: 6027
      name: 'badSignerFlag'
    },
    {
      code: 6028
      name: 'badWritableFlag'
    },
    {
      code: 6029
      name: 'alreadyFulfilled'
    },
    {
      code: 6030
      name: 'invalidFulfillCalls'
    },
    {
      code: 6031
      name: 'invalidIntent'
    },
    {
      code: 6032
      name: 'invalidIntentHash'
    },
    {
      code: 6033
      name: 'invalidRouteMint'
    },
    {
      code: 6034
      name: 'invalidRouteTokenAccount'
    },
    {
      code: 6035
      name: 'invalidProver'
    },
  ]
  types: [
    {
      name: 'call'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'destination'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'calldata'
            type: 'bytes'
          },
        ]
      }
    },
    {
      name: 'claimIntentNativeArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
        ]
      }
    },
    {
      name: 'claimIntentSplArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'tokenToClaim'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'fulfillIntentArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'route'
            type: {
              defined: {
                name: 'route'
              }
            }
          },
          {
            name: 'reward'
            type: {
              defined: {
                name: 'reward'
              }
            }
          },
        ]
      }
    },
    {
      name: 'fundIntentNativeArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
        ]
      }
    },
    {
      name: 'fundIntentSplArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'tokenToFund'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'intent'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'status'
            type: {
              defined: {
                name: 'intentStatus'
              }
            }
          },
          {
            name: 'route'
            type: {
              defined: {
                name: 'route'
              }
            }
          },
          {
            name: 'reward'
            type: {
              defined: {
                name: 'reward'
              }
            }
          },
          {
            name: 'tokensFunded'
            type: 'u8'
          },
          {
            name: 'nativeFunded'
            type: 'bool'
          },
          {
            name: 'solver'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'intentFulfillmentMarker'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'intentStatus'
      repr: {
        kind: 'rust'
      }
      type: {
        kind: 'enum'
        variants: [
          {
            name: 'initialized'
          },
          {
            name: 'funded'
          },
          {
            name: 'dispatched'
          },
          {
            name: 'fulfilled'
          },
          {
            name: 'refunded'
          },
          {
            name: 'claimed'
          },
        ]
      }
    },
    {
      name: 'publishIntentArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'salt'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'destinationDomainId'
            type: 'u32'
          },
          {
            name: 'inbox'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'routeTokens'
            type: {
              vec: {
                defined: {
                  name: 'tokenAmount'
                }
              }
            }
          },
          {
            name: 'calls'
            type: {
              vec: {
                defined: {
                  name: 'call'
                }
              }
            }
          },
          {
            name: 'rewardTokens'
            type: {
              vec: {
                defined: {
                  name: 'tokenAmount'
                }
              }
            }
          },
          {
            name: 'nativeReward'
            type: 'u64'
          },
          {
            name: 'deadline'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'refundIntentNativeArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
        ]
      }
    },
    {
      name: 'refundIntentSplArgs'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'intentHash'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'tokenToRefund'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'reward'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'creator'
            type: 'pubkey'
          },
          {
            name: 'tokens'
            type: {
              vec: {
                defined: {
                  name: 'tokenAmount'
                }
              }
            }
          },
          {
            name: 'prover'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'nativeAmount'
            type: 'u64'
          },
          {
            name: 'deadline'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'route'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'salt'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'sourceDomainId'
            type: 'u32'
          },
          {
            name: 'destinationDomainId'
            type: 'u32'
          },
          {
            name: 'inbox'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'tokens'
            type: {
              vec: {
                defined: {
                  name: 'tokenAmount'
                }
              }
            }
          },
          {
            name: 'calls'
            type: {
              vec: {
                defined: {
                  name: 'call'
                }
              }
            }
          },
        ]
      }
    },
    {
      name: 'tokenAmount'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'token'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'amount'
            type: 'u64'
          },
        ]
      }
    },
  ]
}
