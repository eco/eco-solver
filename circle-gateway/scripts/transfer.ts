/* eslint-disable */

import {
  account,
  BASE_SEPOLIA_CHAIN_ID,
  createPublicClient,
  createWalletClient,
  gateway,
  gatewayMinterAbi,
  gatewayMinterAddress,
  getChainInfo,
  SEPOLIA_CHAIN_ID,
} from '../setup'
import { GatewayClient } from '../gateway-client'
import { burnIntent, burnIntentTypedData } from '../types/typed-data'
import { parseUnits } from 'viem'

async function transfer(fromChainId: number, toChainId: number, amount: bigint): Promise<void> {
  // Get chain info for source and destination
  const fromChainInfo = getChainInfo(fromChainId)
  const toChainInfo = getChainInfo(toChainId)

  console.log(`Transferring ${amount} USDC from ${fromChainInfo.name} to ${toChainInfo.name}`)

  // Check the info endpoint to confirm which chains are supported
  console.log('Fetching Gateway API info...')
  const info = await gateway.info()
  for (const domain of info.domains) {
    console.log(
      `  - ${domain.chain} ${domain.network}`,
      `(wallet: ${'walletContract' in domain}, minter: ${'minterContract' in domain})`,
    )
  }

  // Check the account's balances with the Gateway API
  console.log(`Checking balances...`)
  const { balances } = await gateway.balances('USDC', account.address)
  for (const balance of balances) {
    console.log(`  - ${GatewayClient.CHAINS[balance.domain]}:`, `${balance.balance} USDC`)
  }

  // Check balance for the source chain
  const sourceBalance = balances.find((b) => b.domain === fromChainInfo.domain)?.balance || '0'
  const sourceBalanceInUnits = parseUnits(sourceBalance, 6)

  if (sourceBalanceInUnits < amount) {
    console.error(`Insufficient balance on ${fromChainInfo.name}!`)
    console.error(`Available: ${sourceBalance} USDC, Required: ${amount / 1000000n} USDC`)
    process.exit(1)
  }

  console.log('Sufficient balance detected!')

  // Build the burn intent
  const intent = burnIntent({
    account,
    fromChainId,
    toChainId,
    amount,
  })

  console.log('Signing burn intent...')
  const typedData = burnIntentTypedData(intent)
  const signature = await account.signTypedData(typedData)
  const request = [{ burnIntent: typedData.message, signature }]

  // Submit the signed burn intent to Gateway
  console.log('Submitting transfer to Gateway...')
  const response = await gateway.transfer(request)

  if ('message' in response) {
    console.error('Error from Gateway API:', response.message)
    process.exit(1)
  }

  const publicClient = createPublicClient(toChainId)
  const walletClient = createWalletClient(toChainId, account)

  // Mint the funds on destination chain
  console.log(`Minting funds on ${toChainInfo.name}...`)
  const { attestation, signature: mintSignature } = response
  const mintTx = await walletClient.writeContract({
    address: gatewayMinterAddress,
    abi: gatewayMinterAbi,
    functionName: 'gatewayMint',
    args: [attestation, mintSignature],
  })

  await publicClient.waitForTransactionReceipt({ hash: mintTx })
  console.log('Done! Transaction hash:', mintTx)
  console.log(
    `Successfully transferred ${amount / 1000000n} USDC from ${fromChainInfo.name} to ${toChainInfo.name}`,
  )
}

// Parse command line arguments
const fromChainId = SEPOLIA_CHAIN_ID
const toChainId = BASE_SEPOLIA_CHAIN_ID
const amountStr = '0.01'

// Parse amount (USDC has 6 decimals)
const amount = parseUnits(amountStr, 6)

// Execute transfer
transfer(fromChainId, toChainId, amount).catch((error) => {
  console.error('Error in transfer script:', error)
  process.exit(1)
})
