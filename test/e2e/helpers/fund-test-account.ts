import { Address, createPublicClient, createWalletClient, erc20Abi, http, parseUnits } from 'viem';

import { TEST_ACCOUNTS, TEST_RPC, TOKEN_ADDRESSES } from './test-app.helper';

/**
 * Kernel wallet address used by the executor in E2E tests
 * This address is deterministically derived from the signer in test config
 */
export const KERNEL_WALLET_ADDRESS = '0x479B996F6323cf269B45DC642B2fa1722baa84c3' as Address;

/**
 * Signer address for kernel wallet (from config claimant)
 * This address needs ETH for gas to send transactions
 */
export const KERNEL_SIGNER_ADDRESS = '0x256B70644f5D77bc8e2bb82C731Ddf747ecb1471' as Address;

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

/**
 * Fund the Kernel wallet and signer with USDC and ETH
 *
 * The Kernel wallet needs:
 * - USDC on both chains (for approvals and transfers)
 * - The signer needs ETH for gas (to submit transactions)
 */
export async function fundKernelWallet() {
  console.log('Funding Kernel wallet and signer for execution...');

  const publicClientOptimism = createPublicClient({
    transport: http(TEST_RPC.OPTIMISM_MAINNET),
  });

  const publicClientBase = createPublicClient({
    transport: http(TEST_RPC.BASE_MAINNET),
  });

  // USDC whale addresses
  const BASE_USDC_WHALE = '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A' as Address;
  const OP_USDC_WHALE = '0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0' as Address;

  // Fund kernel wallet with USDC on Optimism
  await fundOnChain(
    TEST_RPC.OPTIMISM_MAINNET,
    TOKEN_ADDRESSES.OPTIMISM_USDC as Address,
    OP_USDC_WHALE,
    KERNEL_WALLET_ADDRESS,
    parseUnits('1000000', 6), // 1M USDC
  );

  // Fund kernel wallet with USDC on Base
  await fundOnChain(
    TEST_RPC.BASE_MAINNET,
    TOKEN_ADDRESSES.BASE_USDC as Address,
    BASE_USDC_WHALE,
    KERNEL_WALLET_ADDRESS,
    parseUnits('1000000', 6), // 1M USDC
  );

  // Fund signer with ETH for gas on Optimism
  await publicClientOptimism.request({
    method: 'anvil_setBalance' as any,
    params: [KERNEL_SIGNER_ADDRESS, '0x56bc75e2d63100000'] as any, // 100 ETH in hex
  });

  // Fund signer with ETH for gas on Base
  await publicClientBase.request({
    method: 'anvil_setBalance' as any,
    params: [KERNEL_SIGNER_ADDRESS, '0x56bc75e2d63100000'] as any, // 100 ETH
  });

  console.log(`  Signer ${KERNEL_SIGNER_ADDRESS} funded with 100 ETH on both chains`);
  console.log('✓ Kernel wallet and signer funded');
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
