/* eslint-disable */

import {
  account,
  SEPOLIA_CHAIN_ID,
  createPublicClient,
  createWalletClient,
  usdcAddresses,
  gatewayWalletAddress,
  erc20Abi,
  gatewayWalletAbi,
  getChainInfo,
} from '../setup'
import { parseUnits } from 'viem'

async function depositToGateway(chainId: number, depositAmount: bigint): Promise<void> {
  // Get chain info
  const chainInfo = getChainInfo(chainId)
  const usdcAddress = usdcAddresses[chainId]

  // Create clients
  const publicClient = createPublicClient(chainId)
  const walletClient = createWalletClient(chainId, account)

  console.log(`Checking USDC balance on ${chainInfo.name}...`)

  const balance = (await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })) as bigint

  if (balance < depositAmount) {
    console.error(`Insufficient USDC balance on ${chainInfo.name}!`)
    console.error('Please top up at https://faucet.circle.com.')
    process.exit(1)
  }

  try {
    console.log('Approving the GatewayWallet contract for USDC...')
    const approvalTx = await walletClient.writeContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [gatewayWalletAddress, depositAmount],
    })

    await publicClient.waitForTransactionReceipt({ hash: approvalTx })
    console.log('Done! Transaction hash:', approvalTx)

    console.log('Depositing USDC into the GatewayWallet contract...')
    const depositTx = await walletClient.writeContract({
      address: gatewayWalletAddress,
      abi: gatewayWalletAbi,
      functionName: 'deposit',
      args: [usdcAddress, depositAmount],
    })
    await publicClient.waitForTransactionReceipt({ hash: depositTx })
    console.log('Done! Transaction hash:', depositTx)
  } catch (error: any) {
    if (error.details?.includes('insufficient funds')) {
      console.error(
        `The wallet does not have enough ${chainInfo.currency} to pay for gas on ${chainInfo.name}!`,
      )
      console.error('Please top up using a faucet.')
    } else {
      console.error('Transaction failed:', error)
    }
    process.exit(1)
  }
}

depositToGateway(SEPOLIA_CHAIN_ID, parseUnits('1', 6)).catch((error) => {
  console.error('Error in deposit script:', error)
  process.exit(1)
})
