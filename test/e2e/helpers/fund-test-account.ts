import {
  Address,
  createPublicClient,
  encodeAbiParameters,
  erc20Abi,
  http,
  keccak256,
  parseUnits,
} from 'viem';

import {
  getRpcUrl,
  getTokenAddress,
  KERNEL_SIGNER_ADDRESS,
  KERNEL_WALLET_ADDRESS,
} from './e2e-config';
import { BASE_MAINNET_CHAIN_ID, OPTIMISM_MAINNET_CHAIN_ID, TEST_ACCOUNTS } from './test-app.helper';

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
    getRpcUrl(BASE_MAINNET_CHAIN_ID),
    getTokenAddress(BASE_MAINNET_CHAIN_ID, 'USDC'),
    BASE_USDC_WHALE,
    TEST_ACCOUNTS.ACCOUNT_0.address as Address,
    parseUnits('10000', 6), // 10,000 USDC
  );

  // Fund on Optimism
  await fundOnChain(
    getRpcUrl(OPTIMISM_MAINNET_CHAIN_ID),
    getTokenAddress(OPTIMISM_MAINNET_CHAIN_ID, 'USDC'),
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
    transport: http(getRpcUrl(OPTIMISM_MAINNET_CHAIN_ID)),
  });

  const publicClientBase = createPublicClient({
    transport: http(getRpcUrl(BASE_MAINNET_CHAIN_ID)),
  });

  // USDC whale addresses
  const BASE_USDC_WHALE = '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A' as Address;
  const OP_USDC_WHALE = '0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0' as Address;

  // Fund kernel wallet with USDC on Optimism
  await fundOnChain(
    getRpcUrl(OPTIMISM_MAINNET_CHAIN_ID),
    getTokenAddress(OPTIMISM_MAINNET_CHAIN_ID, 'USDC'),
    OP_USDC_WHALE,
    KERNEL_WALLET_ADDRESS,
    parseUnits('1000000', 6), // 1M USDC
  );

  // Fund kernel wallet with USDC on Base
  await fundOnChain(
    getRpcUrl(BASE_MAINNET_CHAIN_ID),
    getTokenAddress(BASE_MAINNET_CHAIN_ID, 'USDC'),
    BASE_USDC_WHALE,
    KERNEL_WALLET_ADDRESS,
    parseUnits('1000000', 6), // 1M USDC
  );

  // Fund Kernel wallet with ETH for gas on Optimism
  await publicClientOptimism.request({
    method: 'anvil_setBalance' as any,
    params: [KERNEL_WALLET_ADDRESS, '0x56bc75e2d63100000'] as any, // 100 ETH in hex
  });

  // Fund Kernel wallet with ETH for gas on Base
  await publicClientBase.request({
    method: 'anvil_setBalance' as any,
    params: [KERNEL_WALLET_ADDRESS, '0x56bc75e2d63100000'] as any, // 100 ETH
  });

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

  console.log(`  Kernel wallet ${KERNEL_WALLET_ADDRESS} funded with 100 ETH on both chains`);
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

  // Use anvil_setStorageAt to directly set the token balance
  // This is more reliable than transferring from a whale (which can be drained by previous tests)

  // ERC20 balance storage slot is keccak256(abi.encode(address, uint256(balanceSlot)))
  // For most USDC implementations, balance slot is 9
  const balanceSlot = 9n; // USDC uses slot 9 for balances

  // Calculate storage slot: keccak256(abi.encode(recipient, balanceSlot))
  const storageSlot = keccak256(
    encodeAbiParameters(
      [
        { name: 'account', type: 'address' },
        { name: 'slot', type: 'uint256' },
      ],
      [recipient, balanceSlot],
    ),
  );

  // Set the balance using anvil_setStorageAt
  await publicClient.request({
    method: 'anvil_setStorageAt' as any,
    params: [tokenAddress, storageSlot, `0x${amount.toString(16).padStart(64, '0')}` as any] as any,
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
