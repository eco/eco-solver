import { Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';

@Processor('blockchain-execution')
export class BlockchainProcessor extends WorkerHost {
  constructor(private blockchainService: BlockchainExecutorService) {
    super();
  }

  async process(job: Job<ExecutionJobData>) {
    const { intent, strategy } = job.data;
    console.log(`Executing intent ${intent.intentHash} with strategy ${strategy}`);

    // The executeIntent method accepts an optional walletId parameter
    // If not provided, it will use the default wallet type
    await this.blockchainService.executeIntent(intent);
  }
}
