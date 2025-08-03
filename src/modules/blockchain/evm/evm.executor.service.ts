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
  private publicClient: any;
  private walletManager: EvmWalletManager;

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
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

    this.publicClient = this.transportService.getPublicClient(evmConfig.chainId);

    // Initialize wallet manager with a default basic wallet
    this.walletManager.initialize(
      [
        {
          id: 'default',
          type: 'basic',
          privateKey: evmConfig.privateKey as `0x${string}`,
        },
      ],
      this.transportService,
      evmConfig.chainId,
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
        args: [intent.intentId, intent.route.inbox, '0x'], // TODO: Determine what data should be passed
        value: intent.reward.nativeValue,
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
