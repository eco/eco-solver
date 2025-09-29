import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LeaderElectionConfig } from '@/config/schemas/leader-election.schema';

@Injectable()
export class LeaderElectionConfigService {
  constructor(private configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.get<boolean>('leaderElection.enabled') ?? false;
  }

  get lockKey(): string {
    return this.configService.get<string>('leaderElection.lockKey') ?? 'solver:leader:lock';
  }

  get lockTtlSeconds(): number {
    return this.configService.get<number>('leaderElection.lockTtlSeconds') ?? 30;
  }

  get heartbeatIntervalMs(): number {
    return this.configService.get<number>('leaderElection.heartbeatIntervalMs') ?? 10000;
  }

  get electionCheckIntervalMs(): number {
    return this.configService.get<number>('leaderElection.electionCheckIntervalMs') ?? 5000;
  }

  get config(): LeaderElectionConfig {
    return this.configService.get<LeaderElectionConfig>('leaderElection')!;
  }
}
