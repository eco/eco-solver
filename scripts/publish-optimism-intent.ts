// #!/usr/bin/env ts-node

// import { createPublicClient, createWalletClient, http, parseEther, Address, encodeFunctionData } from 'viem'
// import { privateKeyToAccount } from 'viem/accounts'
// import { optimism } from 'viem/chains'
// import * as dotenv from 'dotenv'
// import { VmType } from '@/eco-configs/eco-config.types'
// import { RouteType, IntentType, RewardType } from '@/utils/encodeAndHash'
// import { getChainConfig } from '@/eco-configs/utils'
// import config from '../config/solana'
// import { encodeRoute, hashIntent } from '@/intent/check-funded-solana'
// import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js'
// import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token'

// // Load environment variables from .env file
// dotenv.config()

// interface TokenAmount {
//   token: string
//   amount: number
// }

// const deadlineWindow = 7200 // 2 hours

// // Parse command line arguments
// const args = process.argv.slice(2)
// const shouldFund = args.includes('--fund') && args[args.indexOf('--fund') + 1] === 'yes'

// async function publishOptimismToSolanaIntent(fundIntent: boolean = false) {
//   console.log('Publishing Optimism to Solana Intent...')

//   // Set up Optimism client
//   const optimismRpcUrl = process.env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/-YOtVHJkKQ_JCJkZgabr8sQU8GyWWDbU'
  
//   const publicClient = createPublicClient({
//     chain: optimism,
//     transport: http(optimismRpcUrl)
//   })

//   // Load private key from environment
//   const privateKeyEnv = process.env.OPTIMISM_PRIVATE_KEY
//   if (!privateKeyEnv) {
//     throw new Error('OPTIMISM_PRIVATE_KEY environment variable not found')
//   }

//   const account = privateKeyToAccount(privateKeyEnv as `0x${string}`)
//   const walletClient = createWalletClient({
//     account,
//     chain: optimism,
//     transport: http(optimismRpcUrl)
//   })

//   console.log(`Using account: ${account.address}`)

//   // Create sample route and intent data
//   const now = Math.floor(Date.now() / 1000)
  
//   // Generate salt as 32-byte hex string directly from timestamp
//   const salt = `0x${now.toString(16).padStart(64, '0')}` as `0x${string}`
  
//   // Get portal addresses
//   const optimismPortalAddress = getChainConfig(10).Inbox
//   const solanaPortalAddress: PublicKey = getChainConfig(1399811149).Inbox as PublicKey
  
//   // Sample token amounts for the route (what user wants to swap on Solana)
//   const routeTokens: TokenAmount[] = [
//     {
//       token: config.intentSources[0].tokens[0], // USDC on Solana
//       amount: 1_000 // 0.001 USDC (6 decimals)
//     }
//   ]

//   // Create reward tokens (what user pays on Optimism)
//   const rewardTokens: TokenAmount[] = [
//     {
//       token: config.intentSources[1].tokens[0], // USDC on Optimism
//       amount: 35_500 // 0.0355 USDC reward (6 decimals) - includes solver fee
//     }
//   ]

//   // Create the reward (EVM format for Optimism)
//   const reward: RewardType<VmType.EVM> = {
//     vm: VmType.EVM,
//     deadline: BigInt(now + deadlineWindow), // 2 hours from now
//     creator: account.address,
//     prover: '0x9523b6c0cAaC8122DbD5Dd1c1d336CEBA637038D', // Placeholder - needs actual EVM prover
//     nativeAmount: 0n, 
//     tokens: rewardTokens.map(token => ({
//       token: token.token as Address,
//       amount: BigInt(token.amount)
//     }))
//   }

//   // Create Solana SPL token transfer instruction
//   const tokenMintAddress = new PublicKey(routeTokens[0].token) // USDC on Solana
//   const recipientAddress = new PublicKey('FvqiHNhnQpLS1dbCCrxzneeoAxeM5G6pB9jKuigYuAGC') // Destination wallet
//   const transferAmount = BigInt(500) // 0.0005 USDC (half of the route tokens)

//   // For Solana calls, we need to encode the instruction data
//   // SPL Token Transfer instruction layout:
//   // - Instruction index: 1 byte (3 for Transfer)
//   // - Amount: 8 bytes (little-endian)
//   const transferInstructionData = Buffer.alloc(9)
//   transferInstructionData[0] = 3 // Transfer instruction
//   transferInstructionData.writeBigUInt64LE(transferAmount, 1)

//   // Create the call for the route
//   // Note: In Solana, the 'target' is the program ID (TOKEN_PROGRAM_ID for SPL tokens)
//   // The actual accounts involved are specified differently in the actual transaction
//   const solanaTransferCall = {
//     target: TOKEN_PROGRAM_ID, // SPL Token program
//     data: `0x${transferInstructionData.toString('hex')}` as `0x${string}`,
//     value: 0n // No SOL value for SPL token transfers
//   }

//   const route: RouteType<VmType.SVM> = {
//     vm: VmType.SVM,
//     salt: salt,
//     deadline: BigInt(now + deadlineWindow), // 2 hours from now
//     portal: solanaPortalAddress,
//     tokens: routeTokens.map(token => ({
//       token: new PublicKey(token.token),
//       amount: BigInt(token.amount)
//     })),
//     calls: [solanaTransferCall]
//   }

//   // Create the intent
//   const intent: IntentType = {
//     destination: BigInt(config.intentSources[0].chainID), // Solana chain ID
//     source: BigInt(config.intentSources[1].chainID), // Optimism chain ID
//     route: route,
//     reward: reward
//   }

// //   const hashed = hashIntent(intent.destination, intent.route, intent.reward)

//   console.log('Intent Details:')
//   console.log(`Source Chain (Optimism): ${intent.source}`)
//   console.log(`Destination Chain (Solana): ${intent.destination}`)
//   console.log(`Route deadline: ${new Date(Number(route.deadline) * 1000).toISOString()}`)
//   console.log(`Reward deadline: ${new Date(Number(reward.deadline) * 1000).toISOString()}`)
//   console.log(`Creator: ${account.address}`)
//   console.log(`Native reward: ${Number(reward.nativeAmount) / 1e18} ETH`)
//   console.log(`Route tokens: ${route.tokens.length}`)
//   console.log(`Reward tokens: ${reward.tokens.length}`)
//   console.log(`Route token amount: ${Number(route.tokens[0].amount) / 1e6} USDC`)
//   console.log(`Reward token amount: ${Number(reward.tokens[0].amount) / 1e6} USDC`)
//   console.log(`\nSolana Transfer Call:`)
//   console.log(`  Token: ${tokenMintAddress.toBase58()}`)
//   console.log(`  Recipient: ${recipientAddress.toBase58()}`)
//   console.log(`  Amount: ${Number(transferAmount) / 1e6} USDC`)
//   console.log(`  Instruction Data: ${solanaTransferCall.data}`)

//   try {
//     // Calculate intent hash
//     const intentHash = hashIntent(intent.destination, intent.route, intent.reward)
//     console.log(`Intent hash: ${intentHash.intentHash}`)

//     // Get Intent Source contract from provided portal code
//     const intentSourceAbi = [
//         {
//             "inputs": [
//               {
//                 "internalType": "uint64",
//                 "name": "destination",
//                 "type": "uint64"
//               },
//               {
//                 "internalType": "bytes",
//                 "name": "route",
//                 "type": "bytes"
//               },
//               {
//                 "components": [
//                   {
//                     "internalType": "uint64",
//                     "name": "deadline",
//                     "type": "uint64"
//                   },
//                   {
//                     "internalType": "address",
//                     "name": "creator",
//                     "type": "address"
//                   },
//                   {
//                     "internalType": "address",
//                     "name": "prover",
//                     "type": "address"
//                   },
//                   {
//                     "internalType": "uint256",
//                     "name": "nativeAmount",
//                     "type": "uint256"
//                   },
//                   {
//                     "components": [
//                       {
//                         "internalType": "address",
//                         "name": "token",
//                         "type": "address"
//                       },
//                       {
//                         "internalType": "uint256",
//                         "name": "amount",
//                         "type": "uint256"
//                       }
//                     ],
//                     "internalType": "struct TokenAmount[]",
//                     "name": "tokens",
//                     "type": "tuple[]"
//                   }
//                 ],
//                 "internalType": "struct Reward",
//                 "name": "reward",
//                 "type": "tuple"
//               }
//             ],
//             "name": "publish",
//             "outputs": [
//               {
//                 "internalType": "bytes32",
//                 "name": "intentHash",
//                 "type": "bytes32"
//               },
//               {
//                 "internalType": "address",
//                 "name": "vault",
//                 "type": "address"
//               }
//             ],
//             "stateMutability": "nonpayable",
//             "type": "function"
//         },
//        {
//         name: 'publishAndFund',
//         type: 'function',
//         inputs: [
//           { name: 'destination', type: 'uint64' },
//           { name: 'route', type: 'bytes' },
//           { name: 'reward', type: 'tuple', components: [
//             { name: 'deadline', type: 'uint256' },
//             { name: 'creator', type: 'address' },
//             { name: 'prover', type: 'address' },
//             { name: 'nativeAmount', type: 'uint256' },
//             { name: 'tokens', type: 'tuple[]', components: [
//               { name: 'token', type: 'address' },
//               { name: 'amount', type: 'uint256' }
//             ]}
//           ]},
//           { name: 'allowPartial', type: 'bool' }
//         ],
//         outputs: [
//           { name: 'intentHash', type: 'bytes32' },
//           { name: 'vault', type: 'address' }
//         ]
//       }
//     ] as const

//     const contractAddress = optimismPortalAddress as Address

//     if (fundIntent) {
//       console.log('Publishing and funding intent...')
      
//       // First, we need to approve the contract to spend our tokens
//       const tokenAddress = reward.tokens[0].token
//       const tokenAmount = reward.tokens[0].amount
      
//       console.log(`Approving ${Number(tokenAmount) / 1e6} USDC for contract ${contractAddress}`)
      
//       // ERC20 approve function
//       const approveHash = await walletClient.writeContract({
//         address: tokenAddress,
//         abi: [{
//           name: 'approve',
//           type: 'function',
//           inputs: [
//             { name: 'spender', type: 'address' },
//             { name: 'amount', type: 'uint256' }
//           ]
//         }],
//         functionName: 'approve',
//         args: [contractAddress, tokenAmount]
//       })
      
//       console.log(`Token approval transaction: ${approveHash}`)
      
//       // Wait for approval confirmation
//       await publicClient.waitForTransactionReceipt({ hash: approveHash })
//       console.log('Token approval confirmed')

//       // Now publish and fund the intent
//       const { request } = await publicClient.simulateContract({
//         account,
//         address: contractAddress,
//         abi: intentSourceAbi,
//         functionName: 'publishAndFund',
//         args: [
//           intent.destination,
//           encodeRoute(intent.route),
//           {
//             ...reward,
//           },
//           false // allowPartial
//         ],
//         value: reward.nativeAmount
//       })

//       const hash = await walletClient.writeContract(request)
//       console.log(`Intent published and funded! Transaction hash: ${hash}`)

//       // Wait for confirmation
//       const receipt = await publicClient.waitForTransactionReceipt({ hash })
//       console.log(`Transaction confirmed in block ${receipt.blockNumber}`)

//       return {
//         publishAndFundHash: hash,
//         intentHash: intentHash.intentHash,
//         blockNumber: receipt.blockNumber
//       }
//     } else {
//       console.log('Publishing intent only (no funding)...')

//       const calldata = encodeFunctionData({
//         abi: intentSourceAbi,
//         functionName: 'publish',
//         args: [
//           intent.destination,
//           encodeRoute(intent.route),
//           {
//             deadline: reward.deadline,
//             creator: reward.creator,
//             prover: reward.prover,
//             nativeAmount: reward.nativeAmount,
//             tokens: reward.tokens
//           }
//         ]
//       })
      
//       const { request } = await publicClient.simulateContract({
//         account,
//         address: contractAddress,
//         abi: intentSourceAbi,
//         functionName: 'publish',
//         args: [
//           intent.destination,
//           encodeRoute(intent.route),
//           {
//             deadline: reward.deadline,
//             creator: reward.creator,
//             prover: reward.prover,
//             nativeAmount: reward.nativeAmount,
//             tokens: reward.tokens
//           }
//         ]
//       })

//       const hash = await walletClient.writeContract(request)
//       console.log(`Intent published! Transaction hash: ${hash}`)

//       // Wait for confirmation
//       const receipt = await publicClient.waitForTransactionReceipt({ hash })
//       console.log(`Transaction confirmed in block ${receipt.blockNumber}`)

//       return {
//         publishHash: hash,
//         intentHash: intentHash.intentHash,
//         blockNumber: receipt.blockNumber
//       }
//     }

//   } catch (error) {
//     console.error('Transaction failed:', error)
//     throw error
//   }
// }

// // Run the script
// // Usage: npx ts-node scripts/publish-optimism-to-solana-intent.ts
// // Usage with funding: npx ts-node scripts/publish-optimism-to-solana-intent.ts --fund yes
// console.log(`Running with funding: ${shouldFund}`)
// publishOptimismToSolanaIntent(shouldFund).catch(console.error)