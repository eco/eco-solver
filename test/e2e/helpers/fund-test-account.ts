import { Address, createPublicClient, createWalletClient, erc20Abi, http, parseUnits } from 'viem';

import { TEST_ACCOUNTS, TEST_RPC, TOKEN_ADDRESSES } from './test-app.helper';

/**
 * Fund test accounts with USDC on Base and Optimism using Anvil's impersonateAccount
 *
 * This function:
 * 1. Impersonates a whale address that has USDC on mainnet
 * 2. Transfers USDC to test accounts
 * 3. Stops impersonating
 */
export async function fundTestAccountsWithUSDC() {
  console.log('Funding test accounts with USDC...');

  // USDC whale addresses on mainnet (these are real addresses with large USDC balances)
  const BASE_USDC_WHALE = '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A' as Address; // Coinbase 2
  const OP_USDC_WHALE = '0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0' as Address; // Circle

  // Fund on Base
  await fundOnChain(
    TEST_RPC.BASE_MAINNET,
    TOKEN_ADDRESSES.BASE_USDC as Address,
    BASE_USDC_WHALE,
    TEST_ACCOUNTS.ACCOUNT_0.address as Address,
    parseUnits('10000', 6), // 10,000 USDC
  );

  // Fund on Optimism
  await fundOnChain(
    TEST_RPC.OPTIMISM_MAINNET,
    TOKEN_ADDRESSES.OPTIMISM_USDC as Address,
    OP_USDC_WHALE,
    TEST_ACCOUNTS.ACCOUNT_0.address as Address,
    parseUnits('10000', 6), // 10,000 USDC
  );

  console.log('✓ Test accounts funded with USDC');
}

async function fundOnChain(
  rpcUrl: string,
  tokenAddress: Address,
  whaleAddress: Address,
  recipient: Address,
  amount: bigint,
) {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  // Step 1: Impersonate the whale address
  await publicClient.request({
    method: 'anvil_impersonateAccount' as any,
    params: [whaleAddress] as any,
  });

  // Step 2: Create a wallet client with the whale address
  const whaleClient = createWalletClient({
    account: whaleAddress,
    transport: http(rpcUrl),
  });

  // Step 3: Transfer USDC to recipient
  const txHash = await whaleClient.writeContract({
    chain: null,
    account: whaleAddress,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, amount],
  });

  // Wait for transaction
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Step 4: Stop impersonating
  await publicClient.request({
    method: 'anvil_stopImpersonatingAccount' as any,
    params: [whaleAddress] as any,
  });

  // Verify balance
  const balance = (await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [recipient],
  })) as bigint;

  console.log(
    `  Funded ${recipient} with ${amount.toString()} USDC on ${rpcUrl.includes('8545') ? 'Base' : 'Optimism'}`,
  );
  console.log(`    Final balance: ${balance.toString()}`);
}
