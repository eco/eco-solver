import { Injectable } from '@nestjs/common';
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { BaseChainExecutor, ExecutionResult } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmConfigService } from '@/modules/config/services';

const INBOX_ABI = parseAbi([
  'function fulfillStorage(bytes32 intentId, address target, bytes calldata data) external payable',
]);

@Injectable()
export class EvmExecutor extends BaseChainExecutor {
  private walletClient: any;
  private publicClient: any;

  constructor(private evmConfigService: EvmConfigService) {
    const config: EvmChainConfig = {
      chainType: 'EVM',
      chainId: evmConfigService.chainId,
      rpcUrl: evmConfigService.rpcUrl,
      privateKey: evmConfigService.privateKey,
      intentSourceAddress: evmConfigService.intentSourceAddress,
      inboxAddress: evmConfigService.inboxAddress,
    };
    super(config);
    this.initializeClients();
  }

  private initializeClients() {
    const evmConfig = this.config as EvmChainConfig;
    
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(evmConfig.rpcUrl),
    });

    const account = privateKeyToAccount(evmConfig.privateKey as `0x${string}`);
    
    this.walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(evmConfig.rpcUrl),
    });
  }

  async execute(intent: Intent): Promise<ExecutionResult> {
    try {
      const evmConfig = this.config as EvmChainConfig;
      
      const { request } = await this.publicClient.simulateContract({
        address: evmConfig.inboxAddress as `0x${string}`,
        abi: INBOX_ABI,
        functionName: 'fulfillStorage',
        args: [intent.intentId, intent.target, intent.data],
        value: BigInt(intent.value),
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      
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
        hash: txHash as `0x${string}` 
      });
      return receipt.status === 'success';
    } catch {
      return false;
    }
  }
}