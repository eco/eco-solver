import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import axios, { AxiosInstance } from 'axios';
import { encodeFunctionData, Hex } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

interface PolymerProofRequest {
  srcChainId: number;
  srcBlockNumber: number;
  globalLogIndex: number;
}

interface PolymerProofResponse {
  status: 'pending' | 'ready' | 'error';
  proof?: string;
  error?: string;
}

interface IntentProvenEventData {
  intentHash: Hex;
  claimant: UniversalAddress;
  globalLogIndex: number;
  blockNumber: bigint;
  transactionHash: string;
}

@Injectable()
export class PolymerProver extends BaseProver {
  readonly type = ProverType.POLYMER;
  private polymerApiClient: AxiosInstance;
  private readonly PROOF_POLLING_INTERVAL = 5000; // 5 seconds
  private readonly PROOF_POLLING_TIMEOUT = 300000; // 5 minutes

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
    private readonly logger: SystemLoggerService,
  ) {
    super(blockchainConfigService, moduleRef);
    this.logger.setContext(PolymerProver.name);
    this.initializePolymerClient();
  }

  private initializePolymerClient() {
    // TODO: Get API endpoint from configuration
    const apiEndpoint = process.env.POLYMER_API_ENDPOINT || 'https://proof.polymer.technology';

    this.polymerApiClient = axios.create({
      baseURL: apiEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async generateProof(_intent: Intent): Promise<Hex> {
    // This is used during fulfillment, returns empty proof as Polymer handles it differently
    return '0x';
  }

  /**
   * Request a proof job from Polymer API
   */
  async requestProofJob(params: PolymerProofRequest): Promise<string> {
    try {
      this.logger.log(
        `Requesting proof job from Polymer API for chain ${params.srcChainId} block ${params.srcBlockNumber}`,
      );

      const response = await this.polymerApiClient.post('/api/v1/proof', params);

      if (!response.data?.jobId) {
        throw new Error('Invalid response from Polymer API: missing jobId');
      }

      this.logger.log(`Polymer proof job created: ${response.data.jobId}`);
      return response.data.jobId;
    } catch (error: any) {
      this.logger.error(`Failed to request proof from Polymer API:`, error);
      throw new Error(`Polymer API request failed: ${error?.message || error}`);
    }
  }

  /**
   * Poll Polymer API for proof completion
   */
  async pollForProof(jobId: string): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.PROOF_POLLING_TIMEOUT) {
      try {
        const response = await this.polymerApiClient.get<PolymerProofResponse>(
          `/api/v1/proof/${jobId}`,
        );

        if (response.data.status === 'ready' && response.data.proof) {
          this.logger.log(`Polymer proof ready for job ${jobId}`);
          // Convert base64 to hex if needed
          const proof = response.data.proof.startsWith('0x')
            ? response.data.proof
            : `0x${Buffer.from(response.data.proof, 'base64').toString('hex')}`;
          return proof as Hex;
        }

        if (response.data.status === 'error') {
          throw new Error(`Polymer proof generation failed: ${response.data.error}`);
        }

        // Still pending, wait and retry
        await new Promise((resolve) => setTimeout(resolve, this.PROOF_POLLING_INTERVAL));
      } catch (error: any) {
        if (error?.response?.status === 404) {
          throw new Error(`Polymer proof job ${jobId} not found`);
        }
        this.logger.error(`Error polling for proof:`, error);
        // Continue polling on transient errors
      }
    }

    throw new Error(`Polymer proof polling timeout after ${this.PROOF_POLLING_TIMEOUT}ms`);
  }

  /**
   * Relay proof to the source chain
   */
  async relayProof(intent: Intent, eventData: IntentProvenEventData, proof: Hex): Promise<string> {
    try {
      const sourceChainId = Number(intent.sourceChainId || intent.destination);
      const proverContract = this.getContractAddress(sourceChainId);

      if (!proverContract) {
        throw new Error(`No Polymer prover contract on source chain ${sourceChainId}`);
      }

      this.logger.log(`Relaying proof for intent ${intent.intentHash} to chain ${sourceChainId}`);

      // Get the blockchain reader to access wallet for transaction
      const wallet = await this.getWalletForChain(sourceChainId);

      const proverAddress = AddressNormalizer.denormalizeToEvm(proverContract);

      // Encode the validate function call
      // Note: This ABI should match the Polymer prover contract on source chain
      const validateData = encodeFunctionData({
        abi: [
          {
            name: 'validate',
            type: 'function',
            inputs: [{ name: 'proof', type: 'bytes' }],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'validate',
        args: [proof],
      });

      // Execute the transaction
      const txHash = await wallet.writeContract({
        to: proverAddress,
        data: validateData,
      });

      this.logger.log(
        `Proof relay transaction submitted: ${txHash} for intent ${intent.intentHash}`,
      );

      return txHash;
    } catch (error: any) {
      this.logger.error(`Failed to relay proof for intent ${intent.intentHash}:`, error);
      throw error;
    }
  }

  /**
   * Helper to get wallet for a specific chain
   */
  private async getWalletForChain(_chainId: number): Promise<any> {
    // This will be resolved using the blockchain reader service
    // which is initialized in onModuleInit
    if (!this.blockchainReaderService) {
      throw new Error('BlockchainReaderService not initialized');
    }

    // TODO: Implement wallet retrieval through blockchain service
    // For now, this is a placeholder that will be completed when integrating
    throw new Error('Wallet retrieval not yet implemented');
  }

  async getFee(_intent: Intent, _claimant?: UniversalAddress): Promise<bigint> {
    // Polymer prover doesn't require a fee
    return 0n;
  }

  /**
   * Polymer prover requires proof relay after fulfillment
   */
  needsProofRelay(): boolean {
    return true;
  }

  getDeadlineBuffer(): bigint {
    // TODO: Move to validation
    // PolymerProver requires 1 hour (3600 seconds) for processing
    return 3600n;
  }
}
