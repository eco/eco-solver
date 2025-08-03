import { Injectable } from '@nestjs/common';

import { parseAbi } from 'viem';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { EvmTransportService } from './services/evm-transport.service';

const INBOX_ABI = parseAbi([
  'function fulfillStorage(bytes32 intentId, address target, bytes calldata data) external payable',
]);

@Injectable()
export class EvmExecutorService extends BaseChainExecutor {
  private walletManager: EvmWalletManager;

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    walletManager: EvmWalletManager,
  ) {
    // We don't pass a config to the base class as we handle multiple chains
    super(null as any);
    this.walletManager = walletManager;
    this.initializeWalletManager();
  }

  private initializeWalletManager() {
    // Initialize wallet manager with a default basic wallet for all supported chains
    for (const chainId of this.evmConfigService.supportedChainIds) {
      this.walletManager.initialize(
        [
          {
            id: 'default',
            type: 'basic',
            privateKey: this.evmConfigService.privateKey as `0x${string}`,
          },
        ],
        this.transportService,
        chainId,
      );
    }
  }

  async execute(intent: Intent, walletId?: string): Promise<ExecutionResult> {
    try {
      // Get the destination chain ID from the intent
      const chainId = Number(intent.route.destination);
      const network = this.evmConfigService.getNetworkOrThrow(chainId);
      const wallet = this.walletManager.getWallet(walletId, chainId);
      const publicClient = this.transportService.getPublicClient(chainId);

      const hash = await wallet.writeContract({
        address: network.inboxAddress as `0x${string}`,
        abi: INBOX_ABI,
        functionName: 'fulfillStorage',
        args: [intent.intentId, intent.route.inbox, '0x'], // TODO: Determine what data should be passed
        value: intent.reward.nativeValue,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
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

  async getBalance(address: string, chainId: number): Promise<bigint> {
    const publicClient = this.transportService.getPublicClient(chainId);
    return publicClient.getBalance({ address: address as `0x${string}` });
  }

  async isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean> {
    try {
      const publicClient = this.transportService.getPublicClient(chainId);
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      return receipt.status === 'success';
    } catch {
      return false;
    }
  }
}
