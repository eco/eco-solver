/**
 * ABI for the IInbox contract
 */
export const IInboxAbi = [
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "chainId",
          "type": "uint256"
        }
      ],
      "name": "ChainIdTooLarge",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "intentHash",
          "type": "bytes32"
        }
      ],
      "name": "IntentAlreadyFulfilled",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "IntentExpired",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "intentHash",
          "type": "bytes32"
        }
      ],
      "name": "IntentNotFulfilled",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "expectedHash",
          "type": "bytes32"
        }
      ],
      "name": "InvalidHash",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "portal",
          "type": "address"
        }
      ],
      "name": "InvalidPortal",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ZeroClaimant",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "intentHash",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "claimant",
          "type": "bytes32"
        }
      ],
      "name": "IntentFulfilled",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "intentHash",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "claimant",
          "type": "bytes32"
        }
      ],
      "name": "IntentProven",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "intentHash",
          "type": "bytes32"
        },
        {
          "components": [
            {
              "internalType": "bytes32",
              "name": "salt",
              "type": "bytes32"
            },
            {
              "internalType": "uint64",
              "name": "deadline",
              "type": "uint64"
            },
            {
              "internalType": "address",
              "name": "portal",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "token",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                }
              ],
              "internalType": "struct TokenAmount[]",
              "name": "tokens",
              "type": "tuple[]"
            },
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "target",
                  "type": "address"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                },
                {
                  "internalType": "uint256",
                  "name": "value",
                  "type": "uint256"
                }
              ],
              "internalType": "struct Call[]",
              "name": "calls",
              "type": "tuple[]"
            }
          ],
          "internalType": "struct Route",
          "name": "route",
          "type": "tuple"
        },
        {
          "internalType": "bytes32",
          "name": "rewardHash",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "claimant",
          "type": "bytes32"
        }
      ],
      "name": "fulfill",
      "outputs": [
        {
          "internalType": "bytes[]",
          "name": "",
          "type": "bytes[]"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "intentHash",
          "type": "bytes32"
        },
        {
          "components": [
            {
              "internalType": "bytes32",
              "name": "salt",
              "type": "bytes32"
            },
            {
              "internalType": "uint64",
              "name": "deadline",
              "type": "uint64"
            },
            {
              "internalType": "address",
              "name": "portal",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "token",
                  "type": "address"
                },
                {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
                }
              ],
              "internalType": "struct TokenAmount[]",
              "name": "tokens",
              "type": "tuple[]"
            },
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "target",
                  "type": "address"
                },
                {
                  "internalType": "bytes",
                  "name": "data",
                  "type": "bytes"
                },
                {
                  "internalType": "uint256",
                  "name": "value",
                  "type": "uint256"
                }
              ],
              "internalType": "struct Call[]",
              "name": "calls",
              "type": "tuple[]"
            }
          ],
          "internalType": "struct Route",
          "name": "route",
          "type": "tuple"
        },
        {
          "internalType": "bytes32",
          "name": "rewardHash",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "claimant",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "prover",
          "type": "address"
        },
        {
          "internalType": "uint64",
          "name": "sourceChainDomainID",
          "type": "uint64"
        },
        {
          "internalType": "bytes",
          "name": "data",
          "type": "bytes"
        }
      ],
      "name": "fulfillAndProve",
      "outputs": [
        {
          "internalType": "bytes[]",
          "name": "",
          "type": "bytes[]"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "prover",
          "type": "address"
        },
        {
          "internalType": "uint64",
          "name": "sourceChainDomainID",
          "type": "uint64"
        },
        {
          "internalType": "bytes32[]",
          "name": "intentHashes",
          "type": "bytes32[]"
        },
        {
          "internalType": "bytes",
          "name": "data",
          "type": "bytes"
        }
      ],
      "name": "prove",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    }
  ] as const;
  
  /**
   * Type-safe ABI for the IInbox contract
   */
  export type IInboxAbiType = typeof IInboxAbi;
  
  /**
   * Bytecode for the IInbox contract
   */
  export declare const IInboxBytecode = "0x";
  
  /**
   * Deployed bytecode for the IInbox contract
   */
  export declare const IInboxDeployedBytecode = "0x";
  