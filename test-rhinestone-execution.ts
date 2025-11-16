#!/usr/bin/env tsx
/**
 * Test Rhinestone CLAIM and FILL Execution
 *
 * Flow:
 * 1. Simulate CLAIM → If passes, execute CLAIM
 * 2. Simulate FILL → If passes, execute FILL
 */

import 'dotenv/config'
import {
  createPublicClient,
  createWalletClient,
  http,
  Hex,
  Address,
  erc20Abi,
  encodeFunctionData,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, arbitrum } from 'viem/chains'
import {
  decodeAdapterClaim,
  decodeAdapterFill,
} from './src/modules/rhinestone/utils/decoder'
import { extractIntent } from './src/modules/rhinestone/utils/intent-extractor'

const sampleAction = {
  "type": "RelayerActionV1",
  "id": "4698912736552617627963456144356353103940817662255746165971061524263392509952",
  "timestamp": 1762796346,
  "fill": {
    "call": {
      "chainId": 42161,
      "to": "0x000000000004598d17aad017bf0734a364c5588b",
      "data": "0x00000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000920000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014feebabe17996b3346cf80f04a1f072102a90cf090000000000000000000000000000000000000000000000000000000000000000000000000000000000000820000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000038000000000000000000000000000000000000000000000000000000000000003041c1e7c17000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000005eeb0df30c63390735645a0788a373550ebd57077873624fa6fe09a2f1d6fbea9b74f6f89e5db904d4c1cbbdde9e0f23e29a636d75db6ee4fe5322e8ab6b2cf7b797d0f911214c7b9178d97e7cc39816c4a12a640a637d883d59548e0cd34bbe2fd93d14322a0c450fa6ec8f918c00000000000020ab13229c974e1576565f56af0887fff1601d10c210a8c29e9c70a8832617fa0000000000000000000000000000000000000000000000000000000069122465000000000000000000000000399dbd5df04f83103f77a58cba2b7c4d3cdede97000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000005eeb0df30c63390735645a0788a373550ebd570700000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042426848633000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000003e00000000000000000000000005eeb0df30c63390735645a0788a373550ebd57070a637d883d59548e0cd34bbe2fd93d14322a0c450fa6ec8f918c00000000000000000000000000000000000000000000000000000000000000000000691224650000000000000000000000005eeb0df30c63390735645a0788a373550ebd570700000000000000000000000056ac608c6edc0500163f1e6f059f9f6cdf2e843d0000000000000000000000000000000000000000000000000000000000002105c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a47003cd2f2de20b5b044529e880bd65e9f7e3b8b2aa6e672e72a84cd320ce6b7af7133049e596acdf3680196a8888681318629f7262dfc05e83d63bfb334845943534b0961385c1b28e53f4f63b4ccc1d4dd4c3742f57fa400813d90b7eabe67fd00000000000000000000000000000000000000000000000000000000069122465cc69ac819e2d6a63a8ada61598c19285c4d1f5e1fd7699563ec12d8f0bb7598e00000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000360000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001420304000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000062b2ac83e0c8666d9be4e75b99c0e96c822d23e100000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000550000000000000000000000000000000000000000c71f705c3c5b039fd63b0935750aad32fa2726c0b8e636c8a2fbcf163f09dfb67eb525210bb5a01debe2e64ecc0c9b2b6fa30781b2003f0a73533873bc515dcf1c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041892b7d8173961e906a00227be1baca1b9b00890da4639f9e72b1dfd4346c15c5224d43c1794b73918be1674a406e56ae3b10d998744c9181e033b496f1bbaa3f1b00000000000000000000000000000000000000000000000000000000000000",
      "value": "0"
    },
    "metadata": {
      "settlementLayers": [
        "ECO"
      ],
      "tokensOut": [
        {
          "tokenAddress": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          "amount": "10000"
        }
      ]
    }
  },
  "claims": [
    {
      "call": {
        "chainId": 8453,
        "to": "0x000000000004598d17aad017bf0734a364c5588b",
        "data": "0x0fbb12dc000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014feebabe17996b3346cf80f04a1f072102a90cf09000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000664bb35b1c5000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006200000000000000000000000003ef7cb4f2faa7d13a018f05e155b06260c540e3a000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000005400000000000000000000000005eeb0df30c63390735645a0788a373550ebd57070000000000000000000000005eeb0df30c63390735645a0788a373550ebd57070a637d883d59548e0cd34bbe2fd93d14322a0c450fa6ec8f918c000000000000000000000000000000000000000000000000000000000000000000006912246500000000000000000000000000000000000000000000000000000000691224650000000000000000000000000000000000000000000000000000000000002105000000000000000000000000000000000000000000000000000000000000a4b100000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000004a00000000000000000000000000000000000000000000000000000000000000001608d89211cc8954c170d5903833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000055430000000000000000000000000000000000000000000000000000000000000001608d89211cc8954c170d5903af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000042030400000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001420304000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000062b2ac83e0c8666d9be4e75b99c0e96c822d23e10000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014101c1d5521dc32115089d02774f5298df13dc71f000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000550000000000000000000000000000000000000000c71f705c3c5b039fd63b0935750aad32fa2726c0b8e636c8a2fbcf163f09dfb67eb525210bb5a01debe2e64ecc0c9b2b6fa30781b2003f0a73533873bc515dcf1c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        "value": "0"
      },
      "beforeFill": true,
      "metadata": {
        "tokensIn": [
          {
            "tokenAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            "amount": "21827"
          }
        ],
        "settlementLayer": "ECO"
      }
    }
  ],
  "metadata": {
    "userAddress": "0x5eeb0df30c63390735645a0788a373550ebd5707"
  }
} as const

// Configuration
const SOLVER_PRIVATE_KEY = process.env.SOLVER_PRIVATE_KEY as Hex
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const ARBITRUM_RPC_URL =
  process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'

if (!SOLVER_PRIVATE_KEY) {
  console.error('❌ Error: SOLVER_PRIVATE_KEY not set')
  process.exit(1)
}

// Setup clients
const account = privateKeyToAccount(SOLVER_PRIVATE_KEY)
const solverAddress = account.address

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
})

const arbPublicClient = createPublicClient({
  chain: arbitrum,
  transport: http(ARBITRUM_RPC_URL),
})

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('   RHINESTONE CLAIM & FILL EXECUTION TEST')
  console.log('   Simulate → Execute if successful')
  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  )

  console.log(`Solver Address: ${solverAddress}`)

  // Decode payload
  const payload = sampleAction
  const claimCall = payload.claims[0].call
  const fillCall = payload.fill.call;

  console.log('Decoding payload...')
  const claimData = decodeAdapterClaim(claimCall.data)
  const fillData = decodeAdapterFill(fillCall.data as Hex)
  const intent = extractIntent({ claimData, fillData })

  console.log('Intent:')
  console.log(`  Hash:   ${intent.intentHash}`)
  console.log(
    `  Route:  Base (${intent.sourceChainId}) → Arbitrum (${intent.destination})`,
  )
  console.log(
    `  Reward: ${(Number(intent.reward.tokens[0]?.amount || 0) / 1_000_000).toFixed(6)} USDC`,
  )
  console.log(
    `  Amount: ${(Number(intent.route.tokens[0]?.amount || 0) / 1_000_000).toFixed(6)} USDC\n`,
  )

  // ============================================================================
  // MILESTONE 1: CLAIM (Funding)
  // ============================================================================

  console.log(
    '\n═══════════════════════════════════════════════════════════════',
  )
  console.log('   MILESTONE 1: CLAIM SIMULATION (FUNDING)')
  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  )

  console.log('Transaction Details:')
  console.log(`  Chain:    ${claimCall.chainId} (Base)`)
  console.log(`  To:       ${claimCall.to}`)
  console.log(`  Calldata: ${claimCall.data.slice(0, 66)}...\n`)

  console.log('Order from CLAIM:')
  console.log(`  Sponsor:  ${claimData.order.sponsor}`)
  console.log(
    `  TokenIn:  ${claimData.order.tokenIn[0][1]} (Reward for solver)`,
  )
  console.log(
    `  TokenOut: ${claimData.order.tokenOut[0][1]} (What user receives)\n`,
  )

  let claimTxHash: Hex | null = null

  try {
    console.log('Simulating CLAIM transaction...')

    const claimResult = await basePublicClient.call({
      to: claimCall.to as Address,
      data: claimCall.data as Hex,
      value: BigInt(claimCall.value),
      account: solverAddress,
    })

    console.log(`✅ CLAIM simulation successful!`)
    console.log(`   Return data: ${claimResult.data || '0x'}\n`)

    const claimGas = await basePublicClient.estimateGas({
      to: claimCall.to as Address,
      data: claimCall.data as Hex,
      value: BigInt(claimCall.value),
      account: solverAddress,
    })

    console.log(`✅ Gas estimate: ${claimGas}`)
    console.log(
      `   Cost: ~${((Number(claimGas) * 2e9) / 1e18).toFixed(6)} ETH (@ 2 gwei)\n`,
    )

    // Simulation passed → Execute for real
    console.log('Simulation passed! Executing CLAIM transaction...\n')

    const baseWalletClient = createWalletClient({
      chain: base,
      transport: http(BASE_RPC_URL),
      account,
    })

    const claimTxHash = await baseWalletClient.sendTransaction({
      to: claimCall.to as Address,
      data: claimCall.data as Hex,
      value: BigInt(claimCall.value),
    } as any)

    console.log(`✅ CLAIM sent: ${claimTxHash}`)
    console.log(`   https://basescan.org/tx/${claimTxHash}\n`)

    console.log('Waiting for confirmation...')
    const claimReceipt = await basePublicClient.waitForTransactionReceipt({
      hash: claimTxHash,
    })

    console.log(`✅ Confirmed in block ${claimReceipt.blockNumber}`)
    console.log(`   Gas used: ${claimReceipt.gasUsed}\n`)

    if (claimReceipt.status !== 'success') {
      throw new Error('CLAIM reverted!')
    }

    console.log('✅ MILESTONE 1 COMPLETE!\n')
    console.log('Waiting 3 seconds for funding...\n')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  } catch (error) {
    console.error('❌ CLAIM simulation failed:', error)
    console.error('   CLAIM transaction would revert on-chain\n')
    process.exit(1)
  }

  // ============================================================================
  // MILESTONE 2: FILL (Fulfillment)
  // ============================================================================

  console.log(
    '\n═══════════════════════════════════════════════════════════════',
  )
  console.log('   MILESTONE 2: FILL SIMULATION (FULFILLMENT)')
  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  )

  console.log('Transaction Details:')
  console.log(`  Chain:    ${fillCall.chainId} (Arbitrum)`)
  console.log(`  To:       ${fillCall.to}`)
  console.log(`  Calldata: ${fillCall.data.slice(0, 66)}...\n`)

  const token = fillData.route.tokens[0]
  const tokenAddress = token.token
  const tokenAmount = token.amount

  console.log('Tokens Required:')
  console.log(`  Token:  ${tokenAddress} (USDC on Arbitrum)`)
  console.log(
    `  Amount: ${(Number(tokenAmount) / 1_000_000).toFixed(6)} USDC\n`,
  )

  // Step 2a: Check balance
  try {
    console.log('Checking solver balance...')
    const balance = await arbPublicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [solverAddress],
    })

    console.log(`  Balance: ${(Number(balance) / 1_000_000).toFixed(6)} USDC`)

    if (balance < tokenAmount) {
      console.log(
        `  ❌ Insufficient (need ${(Number(tokenAmount - balance) / 1_000_000).toFixed(6)} more)`,
      )
      console.log(`     FILL would fail due to insufficient balance\n`)
    } else {
      console.log(`  ✅ Sufficient\n`)
    }
  } catch (error) {
    console.error('❌ Failed to check balance:', error)
  }

  const ECO_ROUTER_ADDRESS = payload.fill.call.to;

  // Step 2b: Check approval
  try {
    console.log('Checking token approval...')
    const allowance = await arbPublicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [solverAddress, ECO_ROUTER_ADDRESS],
    })

    console.log(
      `  Allowance: ${(Number(allowance) / 1_000_000).toFixed(6)} USDC`,
    )

    if (allowance < tokenAmount) {
      console.log(
        `  ⚠️  Need approval (${(Number(tokenAmount - allowance) / 1_000_000).toFixed(6)} more USDC)`,
      )
      console.log(`  Simulating approval...\n`)

      const approvalGas = await arbPublicClient.estimateGas({
        to: tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [ECO_ROUTER_ADDRESS, tokenAmount],
        }) as Hex,
        account: solverAddress,
      })

      console.log(`  ✅ Approval simulation passed: ${approvalGas} gas`)
      console.log(`     Executing approval...\n`)

      const arbWalletClient = createWalletClient({
        chain: arbitrum,
        transport: http(ARBITRUM_RPC_URL),
        account,
      })

      const approvalTxHash = await arbWalletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ECO_ROUTER_ADDRESS, tokenAmount],
      } as any)

      console.log(`  ✅ Approval sent: ${approvalTxHash}`)
      const approvalReceipt = await arbPublicClient.waitForTransactionReceipt({
        hash: approvalTxHash,
      })
      console.log(`  ✅ Approval confirmed\n`)

      if (approvalReceipt.status !== 'success') {
        throw new Error('Approval reverted!')
      }
    } else {
      console.log(`  ✅ Already approved\n`)
    }
  } catch (error) {
    console.error('❌ Failed to check approval:', error)
  }

  // Step 2c: Simulate FILL
  let fillTxHash: Hex | null = null

  try {
    console.log('Simulating FILL transaction...')

    const fillResult = await arbPublicClient.call({
      to: fillCall.to as Address,
      data: fillCall.data as Hex,
      value: BigInt(fillCall.value),
      account: solverAddress,
    })

    console.log(`✅ FILL simulation successful!`)
    console.log(`   Return data: ${fillResult.data || '0x'}\n`)

    const fillGas = await arbPublicClient.estimateGas({
      to: fillCall.to as Address,
      data: fillCall.data as Hex,
      value: BigInt(fillCall.value),
      account: solverAddress,
    })

    console.log(`✅ Gas estimate: ${fillGas}`)
    console.log(
      `   Cost: ~${((Number(fillGas) * 0.1e9) / 1e18).toFixed(6)} ETH (@ 0.1 gwei)\n`,
    )

    // Simulation passed → Execute for real
    console.log('Simulation passed! Executing FILL transaction...\n')

    const arbWalletClient = createWalletClient({
      chain: arbitrum,
      transport: http(ARBITRUM_RPC_URL),
      account,
    })

    fillTxHash = await arbWalletClient.sendTransaction({
      to: fillCall.to as Address,
      data: fillCall.data as Hex,
      value: BigInt(fillCall.value),
    } as any)

    console.log(`✅ FILL sent: ${fillTxHash}`)
    console.log(`   https://arbiscan.io/tx/${fillTxHash}\n`)

    console.log('Waiting for confirmation...')
    const fillReceipt = await arbPublicClient.waitForTransactionReceipt({
      hash: fillTxHash,
    })

    console.log(`✅ Confirmed in block ${fillReceipt.blockNumber}`)
    console.log(`   Gas used: ${fillReceipt.gasUsed}\n`)

    if (fillReceipt.status !== 'success') {
      throw new Error('FILL reverted!')
    }

    console.log('✅ MILESTONE 2 COMPLETE!\n')
  } catch (error) {
    console.error('❌ FILL failed:', error)
    process.exit(1)
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================

  console.log(
    '\n═══════════════════════════════════════════════════════════════',
  )
  console.log('   🎉 BOTH MILESTONES COMPLETE!')
  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  )

  console.log('What happened:')
  console.log('  ✅ CLAIM: Simulated → Executed → Confirmed')
  console.log(
    '  ✅ FILL:  Simulated → Approved (if needed) → Executed → Confirmed\n',
  )

  console.log('Transaction Hashes:')
  if (claimTxHash) {
    console.log(`  CLAIM: ${claimTxHash}`)
    console.log(`  View:  https://basescan.org/tx/${claimTxHash}`)
  }
  if (fillTxHash) {
    console.log(`  FILL:  ${fillTxHash}`)
    console.log(`  View:  https://arbiscan.io/tx/${fillTxHash}`)
  }
  console.log('')

  console.log('💰 Check your solver wallet on Base for the reward! 🎁\n')

  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  )
}

main()
