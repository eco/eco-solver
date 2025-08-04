import { WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';

interface BlockchainJobData {
  intent: Intent;
  walletAddress: string;
}

export class BlockchainProcessor extends WorkerHost {
  constructor(private blockchainService: BlockchainExecutorService) {
    super();
  }

  async process(job: Job<BlockchainJobData>) {
    const { intent, walletAddress } = job.data;
    console.log(`Executing intent ${intent.intentHash} for wallet ${walletAddress}`);
    await this.blockchainService.executeIntent(intent, walletAddress);
  }
}
