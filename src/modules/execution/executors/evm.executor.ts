import { Injectable } from '@nestjs/common';

import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { EvmWalletManager } from '@/modules/execution/services/evm-wallet-manager.service';

const INBOX_ABI = parseAbi([
  'function fulfillStorage(bytes32 intentId, address target, bytes calldata data) external payable',
]);

@Injectable()
export class EvmExecutor extends BaseChainExecutor {
  private publicClient: any;
  private walletManager: EvmWalletManager;

  constructor(
    private evmConfigService: EvmConfigService,
    walletManager: EvmWalletManager,
  ) {
    const config: EvmChainConfig = {
      chainType: 'EVM',
      chainId: evmConfigService.chainId,
      rpcUrl: evmConfigService.rpcUrl,
      privateKey: evmConfigService.privateKey,
      intentSourceAddress: evmConfigService.intentSourceAddress,
      inboxAddress: evmConfigService.inboxAddress,
    };
    super(config);
    this.walletManager = walletManager;
    this.initializeClients();
  }

  private initializeClients() {
    const evmConfig = this.config as EvmChainConfig;

    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(evmConfig.rpcUrl),
    });

    // Initialize wallet manager with a default basic wallet
    this.walletManager.initialize(
      [
        {
          id: 'default',
          type: 'basic',
          privateKey: evmConfig.privateKey as `0x${string}`,
        },
      ],
      evmConfig.rpcUrl,
      mainnet,
    );
  }

  async execute(intent: Intent, walletId?: string): Promise<ExecutionResult> {
    try {
      const evmConfig = this.config as EvmChainConfig;
      const wallet = this.walletManager.getWallet(walletId);

      const hash = await wallet.writeContract({
        address: evmConfig.inboxAddress as `0x${string}`,
        abi: INBOX_ABI,
        functionName: 'fulfillStorage',
        args: [intent.intentId, intent.target.address, intent.data],
        value: BigInt(intent.value),
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });

      return {
        success: receipt.status === 'success',
        txHash: hash,
      };
    } catch (error) {
      console.error('EVM execution error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getBalance(address: string): Promise<bigint> {
    return this.publicClient.getBalance({ address: address as `0x${string}` });
  }

  async isTransactionConfirmed(txHash: string): Promise<boolean> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      return receipt.status === 'success';
    } catch {
      return false;
    }
  }
}
