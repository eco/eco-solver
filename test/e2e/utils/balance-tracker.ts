import { Address, createPublicClient, erc20Abi, http } from 'viem';

import { getRpcUrl } from '../helpers/e2e-config';

/**
 * Balance Tracker
 *
 * Utility class for tracking token balance changes during E2E tests.
 *
 * Usage:
 *   const tracker = new BalanceTracker(10, tokenAddress, recipientAddress);  // 10 = Optimism
 *   await tracker.snapshot(); // Save initial balance
 *   // ... perform operations ...
 *   await tracker.verifyIncreased(parseUnits('10', 6)); // Verify balance increased by at least 10 USDC
 */
export class BalanceTracker {
  private readonly client: ReturnType<typeof createPublicClient>;
  private initialBalance: bigint | null = null;

  constructor(
    private readonly chainId: number,
    private readonly token: Address,
    private readonly address: Address,
  ) {
    const rpcUrl = getRpcUrl(chainId);
    this.client = createPublicClient({
      chain: getViemChain(chainId),
      transport: http(rpcUrl),
    });
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<bigint> {
    return this.client.readContract({
      address: this.token as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.address],
    });
  }

  /**
   * Take a snapshot of the current balance
   */
  async snapshot(): Promise<void> {
    this.initialBalance = await this.getBalance();
  }

  /**
   * Verify balance increased by at least the specified amount
   */
  async verifyIncreased(minAmount: bigint): Promise<void> {
    if (this.initialBalance === null) {
      throw new Error('Must call snapshot() before verifyIncreased()');
    }

    const currentBalance = await this.getBalance();
    const increase = currentBalance - this.initialBalance;

    if (increase < minAmount) {
      throw new Error(
        `Balance did not increase by expected amount. ` +
          `Expected increase: >= ${minAmount.toString()}, Actual increase: ${increase.toString()}`,
      );
    }
  }

  /**
   * Verify balance has not changed
   */
  async verifyUnchanged(): Promise<void> {
    if (this.initialBalance === null) {
      throw new Error('Must call snapshot() before verifyUnchanged()');
    }

    const currentBalance = await this.getBalance();

    if (currentBalance !== this.initialBalance) {
      throw new Error(
        `Balance changed unexpectedly. ` +
          `Initial: ${this.initialBalance.toString()}, Current: ${currentBalance.toString()}`,
      );
    }
  }

  /**
   * Get the initial balance (from snapshot)
   */
  getInitialBalance(): bigint | null {
    return this.initialBalance;
  }
}
