import {
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  Hex,
  http,
  parseEventLogs,
  parseUnits,
  PublicClient,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { portalAbi } from '@/common/abis/portal.abi';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';

import { TEST_ACCOUNTS, TEST_CHAIN_IDS, TEST_RPC } from './test-app.helper';

export interface IntentBuilderOptions {
  sourceChain: 'base' | 'optimism';
  destinationChain: 'base' | 'optimism';
  tokenAmount?: bigint;
  nativeAmount?: bigint;
  rewardTokenAmount?: bigint;
  rewardNativeAmount?: bigint;
  routeDeadline?: bigint;
  rewardDeadline?: bigint;
  proverAddress?: UniversalAddress;
  creatorAddress?: Address;
  recipient?: Address;
}

/**
 * IntentBuilder - Fluent API for building and publishing test intents
 *
 * Usage:
 *   const builder = new IntentBuilder();
 *   const intent = await builder
 *     .sourceChain('base')
 *     .destinationChain('optimism')
 *     .tokenAmount(parseUnits('100', 6))
 *     .build();
 *
 *   const { intentHash, vault } = await builder.publishAndFund(intent);
 */
export class IntentBuilder {
  private options: IntentBuilderOptions = {
    sourceChain: 'base',
    destinationChain: 'optimism',
    tokenAmount: parseUnits('10', 6), // 10 USDC (within 50 USDC limit)
    nativeAmount: 0n,
    rewardTokenAmount: parseUnits('12', 6), // 12 USDC reward (covers route + fees)
    rewardNativeAmount: 0n,
    routeDeadline: BigInt(Date.now() + 3600000), // 1 hour from now
    rewardDeadline: BigInt(Date.now() + 3600000), // 1 hour from now
    creatorAddress: TEST_ACCOUNTS.ACCOUNT_0.address as Address,
    recipient: TEST_ACCOUNTS.ACCOUNT_1.address as Address,
  };

  private walletClient?: WalletClient;
  private publicClient?: PublicClient;

  /**
   * Set the source chain
   */
  withSourceChain(chain: 'base' | 'optimism'): this {
    this.options.sourceChain = chain;
    return this;
  }

  /**
   * Set the destination chain
   */
  withDestinationChain(chain: 'base' | 'optimism'): this {
    this.options.destinationChain = chain;
    return this;
  }

  /**
   * Set the token amount for the route
   */
  withTokenAmount(amount: bigint): this {
    this.options.tokenAmount = amount;
    return this;
  }

  /**
   * Set the native amount for the route
   */
  withNativeAmount(amount: bigint): this {
    this.options.nativeAmount = amount;
    return this;
  }

  /**
   * Set the reward token amount
   */
  withRewardTokenAmount(amount: bigint): this {
    this.options.rewardTokenAmount = amount;
    return this;
  }

  /**
   * Set the reward native amount
   */
  withRewardNativeAmount(amount: bigint): this {
    this.options.rewardNativeAmount = amount;
    return this;
  }

  /**
   * Set the route deadline
   */
  withRouteDeadline(deadline: bigint): this {
    this.options.routeDeadline = deadline;
    return this;
  }

  /**
   * Set the reward deadline
   */
  withRewardDeadline(deadline: bigint): this {
    this.options.rewardDeadline = deadline;
    return this;
  }

  /**
   * Set the prover address
   */
  withProverAddress(address: UniversalAddress): this {
    this.options.proverAddress = address;
    return this;
  }

  /**
   * Set the creator address
   */
  withCreatorAddress(address: Address): this {
    this.options.creatorAddress = address;
    return this;
  }

  /**
   * Set the recipient address
   */
  withRecipient(address: Address): this {
    this.options.recipient = address;
    return this;
  }

  /**
   * Build the intent object
   */
  build(): Intent {
    const sourceChainId = this.getChainId(this.options.sourceChain);
    const destinationChainId = this.getChainId(this.options.destinationChain);

    const portalAddress = this.getPortalAddress(this.options.destinationChain);
    const tokenAddress = this.getTokenAddress(this.options.destinationChain);
    const sourceTokenAddress = this.getTokenAddress(this.options.sourceChain);
    const proverAddress =
      this.options.proverAddress || this.getDefaultProverAddress(this.options.sourceChain);

    // Build the route calls (simple USDC transfer to recipient)
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [this.options.recipient!, this.options.tokenAmount!],
    });

    const intent: Intent = {
      intentHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, // Will be computed
      sourceChainId,
      destination: destinationChainId,
      route: {
        salt: this.generateSalt(),
        deadline: this.options.routeDeadline!,
        portal: portalAddress,
        nativeAmount: this.options.nativeAmount!,
        tokens: [
          {
            token: tokenAddress,
            amount: this.options.tokenAmount!,
          },
        ],
        calls: [
          {
            target: tokenAddress,
            value: 0n,
            data: transferData,
          },
        ],
      },
      reward: {
        deadline: this.options.rewardDeadline!,
        creator: AddressNormalizer.normalize(
          this.options.creatorAddress!,
          ChainType.EVM,
        ) as UniversalAddress,
        prover: proverAddress,
        nativeAmount: this.options.rewardNativeAmount!,
        tokens: [
          {
            token: sourceTokenAddress,
            amount: this.options.rewardTokenAmount!,
          },
        ],
      },
    };

    // Compute the intent hash
    const { intentHash } = PortalHashUtils.getIntentHash(intent);
    intent.intentHash = intentHash;

    return intent;
  }

  /**
   * Publish and fund an intent on the source chain
   * Returns the intentHash and vault address from the transaction receipt
   */
  async publishAndFund(
    intent: Intent,
    options?: {
      allowPartial?: boolean;
      approveTokenAmount?: bigint; // For testing insufficient funding
    },
  ): Promise<{ intentHash: Hex; vault: Address; txHash: Hex }> {
    const sourceChain = this.options.sourceChain;
    const rpcUrl = this.getRpcUrl(sourceChain);

    // Create clients if not already created
    if (!this.walletClient) {
      const account = privateKeyToAccount(TEST_ACCOUNTS.ACCOUNT_0.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        transport: http(rpcUrl),
      });
    }

    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        transport: http(rpcUrl),
      });
    }

    const portalAddress = this.getPortalAddress(sourceChain);
    const tokenAddress = this.getTokenAddress(sourceChain);
    const denormalizedPortal = AddressNormalizer.denormalizeToEvm(portalAddress);
    const denormalizedToken = AddressNormalizer.denormalizeToEvm(tokenAddress);

    // Step 1: Approve tokens if there are reward tokens
    if (intent.reward.tokens.length > 0) {
      const approvalAmount = options?.approveTokenAmount || intent.reward.tokens[0].amount;

      console.log(
        `Approving ${approvalAmount.toString()} tokens to Portal ${denormalizedPortal}...`,
      );

      const approveTxHash = await this.walletClient.writeContract({
        chain: null,
        account: this.walletClient.account!,
        address: denormalizedToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [denormalizedPortal, approvalAmount],
      });

      await this.publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      console.log(`Token approval confirmed: ${approveTxHash}`);
    }

    // Step 2: Encode the route and build the reward struct
    const encodedRoute = PortalEncoder.encode(intent.route, ChainType.EVM);
    const rewardStruct = this.buildRewardStruct(intent);

    // Step 3: Call publishAndFund with 4 parameters
    const allowPartial = options?.allowPartial ?? false;
    const nativeValue = intent.reward.nativeAmount;

    console.log(`Publishing and funding intent on ${sourceChain}...`);
    console.log(`  Native value: ${nativeValue.toString()}`);
    console.log(`  Allow partial: ${allowPartial}`);

    const publishTxHash = await this.walletClient.writeContract({
      chain: null,
      account: this.walletClient.account!,
      address: denormalizedPortal,
      abi: portalAbi,
      functionName: 'publishAndFund',
      args: [BigInt(intent.destination), encodedRoute, rewardStruct, allowPartial],
      value: nativeValue,
    });

    console.log(`publishAndFund transaction sent: ${publishTxHash}`);

    // Wait for transaction receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: publishTxHash });

    if (receipt.status !== 'success') {
      throw new Error(`publishAndFund transaction failed: ${publishTxHash}`);
    }

    const [intentPublishedEvent] = parseEventLogs({
      abi: portalAbi,
      eventName: 'IntentPublished',
      logs: receipt.logs,
      strict: true,
    });

    const intentHash = intentPublishedEvent.args.intentHash;

    // The vault address is computed deterministically - we'll get it from the contract
    const vault = await this.getVaultAddress(intent);

    console.log(`Intent published successfully!`);
    console.log(`  Intent hash: ${intentHash}`);
    console.log(`  Vault: ${vault}`);

    return { intentHash, vault, txHash: publishTxHash };
  }

  /**
   * Wait for an intent to be funded on-chain
   */
  async waitForIntentFunding(
    intent: Intent,
    timeoutMs: number = 10000,
  ): Promise<{ isFunded: boolean; isComplete: boolean }> {
    const sourceChain = this.options.sourceChain;
    const rpcUrl = this.getRpcUrl(sourceChain);

    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        transport: http(rpcUrl),
      });
    }

    const portalAddress = this.getPortalAddress(sourceChain);
    const denormalizedPortal = AddressNormalizer.denormalizeToEvm(portalAddress);

    const startTime = Date.now();

    const encodedRoute = PortalEncoder.encode(intent.route, ChainType.EVM);
    const rewardStruct = this.buildRewardStruct(intent);

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Use isIntentFunded function
        const isFunded = (await this.publicClient.readContract({
          address: denormalizedPortal,
          abi: portalAbi,
          functionName: 'isIntentFunded',
          args: [BigInt(intent.destination), encodedRoute, rewardStruct],
        })) as boolean;

        if (isFunded) {
          return { isFunded: true, isComplete: true };
        }
      } catch (error) {
        console.warn(`Error checking intent funding status:`, error);
      }

      // Wait 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { isFunded: false, isComplete: false };
  }

  /**
   * Pre-fund an executor wallet with tokens on the destination chain
   * Uses Anvil's setBalance and deal cheats
   */
  async setupExecutorBalances(executorAddress: Address, destinationChain: 'base' | 'optimism') {
    const rpcUrl = this.getRpcUrl(destinationChain);

    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        transport: http(rpcUrl),
      });
    }

    const tokenAddress = this.getTokenAddress(destinationChain);
    const denormalizedToken = AddressNormalizer.denormalizeToEvm(tokenAddress);

    // Set native balance to 100 ETH
    await this.publicClient.request({
      method: 'anvil_setBalance' as any,
      params: [executorAddress, '0x56bc75e2d63100000'], // 100 ETH in hex
    });

    // Deal 1000000 USDC (1M USDC) to executor
    const usdcAmount = parseUnits('1000000', 6); // 1M USDC
    await this.publicClient.request({
      method: 'anvil_deal' as any,
      params: [denormalizedToken, executorAddress, `0x${usdcAmount.toString(16)}`],
    });

    console.log(`Executor ${executorAddress} pre-funded on ${destinationChain}:`);
    console.log(`  Native: 100 ETH`);
    console.log(`  USDC: 1,000,000 USDC`);
  }

  // Private helper methods

  private getChainId(chain: 'base' | 'optimism'): bigint {
    return chain === 'base'
      ? BigInt(TEST_CHAIN_IDS.BASE_SEPOLIA)
      : BigInt(TEST_CHAIN_IDS.OPTIMISM_SEPOLIA);
  }

  private getRpcUrl(chain: 'base' | 'optimism'): string {
    return chain === 'base' ? TEST_RPC.BASE_SEPOLIA : TEST_RPC.OPTIMISM_SEPOLIA;
  }

  private getPortalAddress(_chain: 'base' | 'optimism'): UniversalAddress {
    // Portal address is the same on both chains
    return AddressNormalizer.normalize(
      '0x399Dbd5DF04f83103F77A58cBa2B7c4d3cdede97',
      ChainType.EVM,
    ) as UniversalAddress;
  }

  private getTokenAddress(chain: 'base' | 'optimism'): UniversalAddress {
    // USDC addresses from mainnet
    const usdcBase = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const usdcOptimism = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';

    return AddressNormalizer.normalize(
      chain === 'base' ? usdcBase : usdcOptimism,
      ChainType.EVM,
    ) as UniversalAddress;
  }

  private getDefaultProverAddress(_chain: 'base' | 'optimism'): UniversalAddress {
    // Hyper prover address (same on both chains from config)
    return AddressNormalizer.normalize(
      '0x101c1d5521dc32115089d02774F5298Df13dC71f',
      ChainType.EVM,
    ) as UniversalAddress;
  }

  private generateSalt(): Hex {
    // Generate random salt
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return `0x${Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
  }

  private buildRewardStruct(intent: Intent): any {
    const denormalizedCreator = AddressNormalizer.denormalizeToEvm(intent.reward.creator);
    const denormalizedProver = AddressNormalizer.denormalizeToEvm(intent.reward.prover);

    // Build reward tokens
    const rewardTokens = intent.reward.tokens.map((t) => ({
      token: AddressNormalizer.denormalizeToEvm(t.token),
      amount: t.amount,
    }));

    return {
      deadline: Number(intent.reward.deadline),
      creator: denormalizedCreator,
      prover: denormalizedProver,
      nativeAmount: intent.reward.nativeAmount,
      tokens: rewardTokens,
    };
  }

  private async getVaultAddress(intent: Intent): Promise<Address> {
    const sourceChain = this.options.sourceChain;
    const rpcUrl = this.getRpcUrl(sourceChain);

    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        transport: http(rpcUrl),
      });
    }

    const portalAddress = this.getPortalAddress(sourceChain);
    const denormalizedPortal = AddressNormalizer.denormalizeToEvm(portalAddress);

    const encodedRoute = PortalEncoder.encode(intent.route, ChainType.EVM);
    const rewardStruct = this.buildRewardStruct(intent);

    const vault = (await this.publicClient.readContract({
      address: denormalizedPortal,
      abi: portalAbi,
      functionName: 'intentVaultAddress',
      args: [BigInt(intent.destination), encodedRoute, rewardStruct],
    })) as Address;

    return vault;
  }
}
