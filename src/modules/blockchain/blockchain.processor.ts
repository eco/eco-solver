import { WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainService } from '@/modules/blockchain/blockchain.service';

interface BlockchainJobData {
  intent: Intent;
  walletAddress: string;
}

export class BlockchainProcessor extends WorkerHost {
  constructor(private blockchainService: BlockchainService) {
    super();
  }

  async process(job: Job<BlockchainJobData>) {
    const { intent, walletAddress } = job.data;
    console.log(`Executing intent ${intent.intentId} for wallet ${walletAddress}`);
    await this.blockchainService.executeIntent(intent, walletAddress);
  }
}
