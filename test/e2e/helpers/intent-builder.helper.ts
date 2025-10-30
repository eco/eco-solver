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

import { PublishIntentOptions } from '../utils';

import { getPortalAddress, getProverAddress, getRpcUrl, getTokenAddress } from './e2e-config';
import { BASE_MAINNET_CHAIN_ID, OPTIMISM_MAINNET_CHAIN_ID, TEST_ACCOUNTS } from './test-app.helper';

export interface IntentBuilderOptions {
  sourceChainId: number;
  destinationChainId: number;
  tokenAmount?: bigint;
  nativeAmount?: bigint;
  rewardTokenAmount?: bigint;
  rewardNativeAmount?: bigint;
  routeDeadline?: bigint;
  rewardDeadline?: bigint;
  proverAddress?: UniversalAddress;
  creatorAddress?: Address;
  recipient?: Address;
  // Custom overrides for testing edge cases
  customRouteToken?: UniversalAddress;
  customSourceToken?: UniversalAddress;
  customCalls?: Array<{ target: UniversalAddress; value: bigint; data: Hex }>;
  rewardTokens?: Array<{ token: UniversalAddress; amount: bigint }>;
  allowInvalidChain?: boolean;
}

/**
 * IntentBuilder - Fluent API for building and publishing test intents
 *
 * Usage:
 *   const builder = new IntentBuilder();
 *   const intent = await builder
 *     .withSourceChain(8453)  // Base
 *     .withDestinationChain(10)  // Optimism
 *     .withTokenAmount(parseUnits('100', 6))
 *     .build();
 *
 *   const { intentHash, vault } = await builder.publishAndFund(intent);
 */
export class IntentBuilder {
  private options: IntentBuilderOptions = {
    sourceChainId: BASE_MAINNET_CHAIN_ID,
    destinationChainId: OPTIMISM_MAINNET_CHAIN_ID,
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
   * Set the source chain by chain ID
   */
  withSourceChain(chainId: number): this {
    this.options.sourceChainId = chainId;
    return this;
  }

  /**
   * Set the destination chain by chain ID
   */
  withDestinationChain(chainId: number): this {
    this.options.destinationChainId = chainId;
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
    const sourceChainId = BigInt(this.options.sourceChainId);
    const destinationChainId = BigInt(this.options.destinationChainId);

    const portalAddress = this.options.allowInvalidChain
      ? this.getPortalAddress(OPTIMISM_MAINNET_CHAIN_ID) // Fallback for invalid chains
      : this.getPortalAddress(this.options.destinationChainId);

    const tokenAddress =
      this.options.customRouteToken || this.getTokenAddress(this.options.destinationChainId);
    const sourceTokenAddress =
      this.options.customSourceToken || this.getTokenAddress(this.options.sourceChainId);
    const proverAddress =
      this.options.proverAddress || this.getDefaultProverAddress(this.options.sourceChainId);

    // Build the route calls - use custom if provided, else default ERC20 transfer
    const routeCalls = this.options.customCalls || [
      {
        target: tokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [this.options.recipient!, this.options.tokenAmount!],
        }) as Hex,
      },
    ];

    // Build reward tokens - use custom if provided, else single token
    const rewardTokens = this.options.rewardTokens || [
      {
        token: sourceTokenAddress,
        amount: this.options.rewardTokenAmount!,
      },
    ];

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
        calls: routeCalls,
      },
      reward: {
        deadline: this.options.rewardDeadline!,
        creator: AddressNormalizer.normalize(
          this.options.creatorAddress!,
          ChainType.EVM,
        ) as UniversalAddress,
        prover: proverAddress,
        nativeAmount: this.options.rewardNativeAmount!,
        tokens: rewardTokens,
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
    options?: PublishIntentOptions['fundingOptions'],
  ): Promise<{ intentHash: Hex; vault: Address; txHash: Hex }> {
    const sourceChainId = this.options.sourceChainId;
    const rpcUrl = this.getRpcUrl(sourceChainId);

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

    const portalAddress = this.getPortalAddress(sourceChainId);
    const tokenAddress = this.getTokenAddress(sourceChainId);
    const denormalizedPortal = AddressNormalizer.denormalizeToEvm(portalAddress);
    const denormalizedToken = AddressNormalizer.denormalizeToEvm(tokenAddress);

    // Step 1: Approve tokens if there are reward tokens
    if (intent.reward.tokens.length > 0) {
      const approvalAmount = options?.approveAmount || intent.reward.tokens[0].amount;

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

    console.log(`Publishing and funding intent on chain ${sourceChainId}...`);
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

  // Private helper methods

  private getRpcUrl(chainId: number): string {
    return getRpcUrl(chainId);
  }

  private getPortalAddress(chainId: number): UniversalAddress {
    return AddressNormalizer.normalize(
      getPortalAddress(chainId),
      ChainType.EVM,
    ) as UniversalAddress;
  }

  private getTokenAddress(chainId: number): UniversalAddress {
    return AddressNormalizer.normalize(
      getTokenAddress(chainId, 'USDC'),
      ChainType.EVM,
    ) as UniversalAddress;
  }

  private getDefaultProverAddress(chainId: number): UniversalAddress {
    return AddressNormalizer.normalize(
      getProverAddress(chainId, 'hyper'),
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
    const sourceChainId = this.options.sourceChainId;

    if (!this.publicClient) {
      const rpcUrl = this.getRpcUrl(sourceChainId);
      this.publicClient = createPublicClient({
        transport: http(rpcUrl),
      });
    }

    const portalAddress = this.getPortalAddress(sourceChainId);
    const denormalizedPortal = AddressNormalizer.denormalizeToEvm(portalAddress);

    const encodedRoute = PortalEncoder.encode(intent.route, ChainType.EVM);
    const rewardStruct = this.buildRewardStruct(intent);

    return this.publicClient.readContract({
      address: denormalizedPortal,
      abi: portalAbi,
      functionName: 'intentVaultAddress',
      args: [BigInt(intent.destination), encodedRoute, rewardStruct],
    });
  }
}
