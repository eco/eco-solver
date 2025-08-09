import { Injectable } from '@nestjs/common';

import { hashIntent, InboxAbi } from '@eco-foundation/routes-ts';
import { Address, encodeFunctionData, erc20Abi } from 'viem';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
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
    private readonly logger: SystemLoggerService,
  ) {
    super();
    this.logger.setContext(EvmExecutorService.name);
  }

  async fulfill(intent: Intent, walletId: WalletType): Promise<ExecutionResult> {
    try {
      // Get the destination chain ID from the intent
      const sourceChainId = Number(intent.route.source);
      const destinationChainId = Number(intent.route.destination);

      // Map walletId to wallet type - for backward compatibility
      const wallet = this.walletManager.getWallet(walletId, destinationChainId);

      const claimant = await wallet.getAddress();

      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found.');
      }

      const proverAddr = prover.getContractAddress(destinationChainId);
      const proverFee = await prover.getFee(intent, claimant);
      const proverMessageData = await prover.getMessageData(intent);

      const { intentHash, rewardHash } = hashIntent(intent);

      const inboxAddr = this.evmConfigService.getInboxAddress(destinationChainId);

      const approvalTxs = intent.route.tokens.map(({ token, amount }) => ({
        to: token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [inboxAddr, amount],
        }),
      }));

      const fulfillTx = {
        to: inboxAddr,
        value: proverFee,
        data: encodeFunctionData({
          abi: InboxAbi,
          functionName: 'fulfillAndProve',
          args: [intent.route, rewardHash, claimant, intentHash, proverAddr, proverMessageData],
        }),
      };

      const [hash] = await wallet.writeContracts(
        [...approvalTxs, fulfillTx],
        { value: 0n }, // EOA doesn't send ETH, prover fee is paid by the Kernel wallet
      );

      const publicClient = this.transportService.getPublicClient(destinationChainId);
      await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });

      return {
        success: true,
        txHash: hash,
      };
    } catch (error) {
      this.logger.error('EVM execution error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getBalance(address: string, chainId: number): Promise<bigint> {
    const publicClient = this.transportService.getPublicClient(chainId);
    return publicClient.getBalance({ address: address as Address });
  }

  async getWalletAddress(walletType: WalletType, chainId: bigint | number): Promise<Address> {
    return this.walletManager.getWalletAddress(walletType, Number(chainId));
  }

  async isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean> {
    try {
      const publicClient = this.transportService.getPublicClient(chainId);
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as Address,
      });
      return receipt.status === 'success';
    } catch {
      return false;
    }
  }
}
