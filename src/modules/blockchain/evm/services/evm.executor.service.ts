import { Injectable } from '@nestjs/common';

import { hashIntent, InboxAbi } from '@eco-foundation/routes-ts';
import { Address, encodeFunctionData } from 'viem';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { ProverService } from '@/modules/prover/prover.service';

import { EvmTransportService } from './evm-transport.service';
import { EvmWalletManager, WalletType } from './evm-wallet-manager.service';

@Injectable()
export class EvmExecutorService extends BaseChainExecutor {
  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private walletManager: EvmWalletManager,
    private proverService: ProverService,
  ) {
    super();
  }

  async fulfill(intent: Intent, claimant: Address): Promise<ExecutionResult> {
    try {
      // Get the destination chain ID from the intent
      const sourceChainId = Number(intent.route.source);
      const destinationChainId = Number(intent.route.destination);

      const network = this.evmConfigService.getChain(destinationChainId);
      // Map walletId to wallet type - for backward compatibility
      const wallet = this.walletManager.getWallet('kernel', destinationChainId);

      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found.');
      }

      const proverAddr = prover.getContractAddress(destinationChainId);
      const proverMessageData = await prover.getMessageData(intent);

      const { intentHash, rewardHash } = hashIntent(intent);

      const hash = await wallet.writeContract({
        to: network.inboxAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: InboxAbi,
          functionName: 'fulfillAndProve',
          args: [intent.route, rewardHash, claimant, intentHash, proverAddr, proverMessageData],
        }),
      });

      const publicClient = this.transportService.getPublicClient(destinationChainId);
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

  async getWalletAddress(walletType: WalletType, chainId: bigint | number): Promise<Address> {
    return this.walletManager.getWalletAddress(walletType, Number(chainId));
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
