import { Injectable } from '@nestjs/common';

import { parseAbi } from 'viem';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from './services/evm-transport.service';
import { EvmWalletManager } from './services/evm-wallet-manager.service';

const INBOX_ABI = parseAbi([
  'function fulfillStorage(bytes32 intentId, address target, bytes calldata data) external payable',
]);

@Injectable()
export class EvmExecutorService extends BaseChainExecutor {
  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private walletManager: EvmWalletManager,
  ) {
    super();
  }

  async execute(intent: Intent, walletId?: string): Promise<ExecutionResult> {
    try {
      // Get the destination chain ID from the intent
      const chainId = Number(intent.route.destination);
      const network = this.evmConfigService.getNetworkOrThrow(chainId);
      // Map walletId to wallet type - for backward compatibility
      const walletType = walletId as 'basic' | 'kernel' | undefined;
      const wallet = this.walletManager.getWallet(walletType, chainId);
      const publicClient = this.transportService.getPublicClient(chainId);

      const hash = await wallet.writeContract({
        address: network.inboxAddress as `0x${string}`,
        abi: INBOX_ABI,
        functionName: 'fulfillStorage',
        args: [intent.intentHash, intent.route.inbox, '0x'], // TODO: Determine what data should be passed
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
