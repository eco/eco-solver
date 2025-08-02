import { WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { ExecutionService } from '@/modules/execution/execution.service';

interface ExecutionJobData {
  intent: Intent;
  walletAddress: string;
}

export class ExecutionProcessor extends WorkerHost {
  constructor(private executionService: ExecutionService) {
    super();
  }

  async process(job: Job<ExecutionJobData>) {
    const { intent, walletAddress } = job.data;
    console.log(`Executing intent ${intent.intentId} for wallet ${walletAddress}`);
    await this.executionService.executeIntent(intent);
  }
}
