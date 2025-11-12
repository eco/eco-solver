#!/usr/bin/env ts-node

import {
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  Hex,
  http,
  pad,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, optimism } from 'viem/chains'
import { V2RouteType } from '@/contracts'
import development from 'config/development'
import { getChainConfig } from '@/eco-configs/utils'
import { portalAbi } from '@/contracts/v2-abi/Portal'

interface IntentConfig {
  sourceChain: typeof optimism
  destinationChain: typeof base
  portal: Address
  amount: bigint
  prover: Address
}

async function publishAndFundIntent(config: IntentConfig) {
  console.log('🚀 Starting intent publication from Optimism to Base...')

  // Environment variables validation
  const privateKey = process.env.EVM_PRIVATE_KEY as Hex
  const optimismRpcUrl = 'https://optimism.gateway.tenderly.co'

  if (!privateKey) {
    throw new Error('EVM_PRIVATE_KEY environment variable is required')
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey)
  console.log(`📝 Using account: ${account.address}`)

  // Create clients for Optimism (source chain)
  const publicClient = createPublicClient({
    chain: config.sourceChain,
    transport: http(optimismRpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain: config.sourceChain,
    transport: http(optimismRpcUrl),
  })

  // Intent parameters
  const destination = BigInt(config.destinationChain.id) // Base chain ID: 8453
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7200) // 2hr from current

  const reward = {
    deadline: deadline,
    creator: account.address,
    prover: config.prover,
    nativeAmount: 0n,
    tokens: [], // No token rewards
  }

  const route: V2RouteType = {
    salt: pad(toHex(Date.now()), { size: 32 }),
    deadline: deadline,
    portal: config.portal,
    nativeAmount: 0n,
    tokens: [
      {
        token: development.intentSources.find((s) => s.chainID === 10)?.tokens[0] as Address,
        amount: config.amount,
      },
    ],
    calls: [
      {
        target: development.intentSources.find((s) => s.chainID === 8453)?.tokens[0] as Address, // Base USDC contract
        data: encodeFunctionData({
          abi: [
            {
              name: 'transfer',
              type: 'function',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'nonpayable',
            },
          ],
          functionName: 'transfer',
          args: [account.address, config.amount],
        }),
        value: 0n,
      },
    ],
  }
  //   const encodedRoute = encodeRoute(route)

  try {
    // Get the token address from development config
    const optimismUSDC = development.intentSources.find((s) => s.chainID === 10)
      ?.tokens[0] as Address

    console.log('📊 Checking USDC balance and approval...')

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: optimismUSDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    })

    console.log(`💰 USDC balance: ${usdcBalance} (${Number(usdcBalance) / 1e6} USDC)`)

    if (usdcBalance < config.amount) {
      throw new Error(
        `Insufficient USDC balance. Required: ${Number(config.amount) / 1e6} USDC, Available: ${Number(usdcBalance) / 1e6} USDC`,
      )
    }

    // Check current allowance
    const currentAllowance = await publicClient.readContract({
      address: optimismUSDC,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, config.portal],
    })

    console.log(`🔓 Current allowance: ${currentAllowance}`)

    // Approve tokens if needed
    if (currentAllowance < config.amount) {
      console.log('🔐 Approving USDC tokens...')

      const approveHash = await walletClient.writeContract({
        address: optimismUSDC,
        abi: erc20Abi,
        functionName: 'approve',
        args: [config.portal, config.amount],
      })

      console.log(`📤 Approval transaction: ${approveHash}`)

      // Wait for approval confirmation
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log('✅ Token approval confirmed!')
    }

    console.log('🔍 Simulating publishAndFund transaction...')

    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      address: config.portal,
      abi: portalAbi,
      functionName: 'publishAndFund',
      args: [destination, '0x', reward, false], // allowPartial = false
      value: 0n,
      account: account.address,
    })

    console.log('✅ Simulation successful! Executing transaction...')

    // Execute the transaction
    const txHash = await walletClient.writeContract(request)

    console.log('📤 Transaction submitted!')
    console.log(`🔗 Transaction hash: ${txHash}`)
    console.log(`🔍 View on Optimism Etherscan: https://optimistic.etherscan.io/tx/${txHash}`)

    // Wait for transaction confirmation
    console.log('⏳ Waiting for transaction confirmation...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    if (receipt.status === 'success') {
      console.log('🎉 Transaction confirmed successfully!')
      console.log(`⛽ Gas used: ${receipt.gasUsed}`)

      // Extract intent hash from logs
      const intentPublishedLog = receipt.logs.find(
        (log) => log.topics[0] === '0x...', // IntentPublished event signature would go here
      )

      if (intentPublishedLog) {
        console.log('📋 Intent Published Event found in logs')
        // Decode the log to get intent hash
      }
    } else {
      console.error('❌ Transaction failed!')
      throw new Error('Transaction reverted')
    }
  } catch (error) {
    console.error('💥 Error publishing intent:', error)
    throw error
  }
}

// Main execution
async function main() {
  const config: IntentConfig = {
    sourceChain: optimism,
    destinationChain: base,
    portal: getChainConfig(10).IntentSource,
    amount: 1000n,
    prover: getChainConfig(10).HyperProver,
  }

  try {
    await publishAndFundIntent(config)
    console.log('🏁 Script completed successfully!')
  } catch (error) {
    console.error('💀 Script failed:', error)
    process.exit(1)
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { publishAndFundIntent, IntentConfig }
