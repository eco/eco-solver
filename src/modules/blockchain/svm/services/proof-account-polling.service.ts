import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Connection, PublicKey } from '@solana/web3.js';
import { EMPTY, from, interval, Subscription } from 'rxjs';
import { catchError, exhaustMap } from 'rxjs/operators';
import { Hex } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { toError } from '@/common/utils/error-handler';
import { ProofAccountMonitor } from '@/modules/blockchain/svm/utils/proof-account-monitor';
import { SolanaConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { Intent } from '@/modules/intents/schemas/intent.schema';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

@Injectable()
export class ProofAccountPollingService implements OnModuleInit, OnModuleDestroy {
  private pollingSubscription: Subscription | null = null;
  private hyperProverProgramId: PublicKey | null = null;
  private connection: Connection;

  constructor(
    private readonly intentsService: IntentsService,
    private readonly solanaConfigService: SolanaConfigService,
    private readonly eventsService: EventsService,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly otelService: OpenTelemetryService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(ProofAccountPollingService.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
  }

  async onModuleInit() {
    // Check if proof polling is enabled
    if (!this.solanaConfigService.proofPollingEnabled) {
      this.logger.log('Proof account polling is disabled via configuration');
      return;
    }

    // Get HyperProver program ID
    const hyperProverAddress = this.solanaConfigService.getProverAddress(
      this.solanaConfigService.chainId,
      'hyper',
    );

    if (!hyperProverAddress) {
      this.logger.warn('HyperProver address not configured, proof polling will not start');
      return;
    }

    try {
      const hyperProverSolanaAddress = AddressNormalizer.denormalizeToSvm(hyperProverAddress);
      this.hyperProverProgramId = new PublicKey(hyperProverSolanaAddress);

      this.logger.log(`HyperProver program ID: ${this.hyperProverProgramId.toString()}`);
    } catch (error) {
      this.logger.error('Failed to parse HyperProver address:', toError(error));
      return;
    }

    // Start polling
    this.startPolling();
  }

  async onModuleDestroy() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.logger.log('Proof account polling stopped');
    }
  }

  private startPolling() {
    const intervalMs = this.solanaConfigService.proofPollingIntervalMs;

    this.logger.log(
      `Starting proof account polling (interval: ${intervalMs}ms, batch size: ${this.solanaConfigService.proofPollingBatchSize})`,
    );

    // Use timer with exhaustMap to prevent overlapping polls
    this.pollingSubscription = interval(intervalMs)
      .pipe(
        exhaustMap(() =>
          from(this.pollProofAccounts()).pipe(
            catchError((error) => {
              this.logger.error('Proof account polling error:', toError(error));
              return EMPTY; // Continue polling despite errors
            }),
          ),
        ),
      )
      .subscribe();
  }

  private async pollProofAccounts(): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'svm.proof_account_polling.poll',
      async (span) => {
        try {
          span.setAttribute('polling.leader', this.leaderElectionService.isCurrentLeader());

          // Skip if not leader
          if (!this.leaderElectionService.isCurrentLeader()) {
            span.setAttribute('polling.skipped', true);
            span.setAttribute('polling.skip_reason', 'not_leader');
            span.setStatus({ code: api.SpanStatusCode.OK });
            return;
          }

          const startTime = Date.now();

          // 1. Get fulfilled but not proven intents for Solana source chain
          const sourceChainId = BigInt(this.solanaConfigService.chainId);
          const intents = await this.intentsService.findFulfilledNotProven(sourceChainId);

          span.setAttribute('polling.intents_checked', intents.length);

          if (intents.length === 0) {
            span.setAttribute('polling.proofs_found', 0);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return;
          }

          // 2. Check proof accounts in batches
          const provenIntents = await this.checkProofAccountsBatch(intents);

          span.setAttribute('polling.proofs_found', provenIntents.length);

          // 3. Emit events for newly proven intents
          for (const { intent, proofData } of provenIntents) {
            this.eventsService.emit('intent.proven', {
              intentHash: intent.intentHash as Hex,
              claimant: AddressNormalizer.normalizeSvm(proofData.claimant) as UniversalAddress,
              transactionHash: '', // Not available from proof account
              blockNumber: undefined,
              chainId: sourceChainId,
              timestamp: new Date(),
            });

            span.addEvent('proof.detected', {
              'intent.hash': intent.intentHash,
              'proof.destination': proofData.destination.toString(),
              'proof.claimant': proofData.claimant.toString(),
            });

            this.logger.log(
              `Detected proof for intent ${intent.intentHash} (destination: ${proofData.destination})`,
            );
          }

          const duration = Date.now() - startTime;
          span.setAttribute('polling.duration_ms', duration);

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          this.logger.error('Error during proof account polling:', toError(error));
          throw error; // Let RxJS catchError handle it
        } finally {
          span.end();
        }
      },
    );
  }

  private async checkProofAccountsBatch(intents: Intent[]): Promise<
    Array<{
      intent: Intent;
      proofData: { destination: bigint; claimant: PublicKey };
    }>
  > {
    const batchSize = this.solanaConfigService.proofPollingBatchSize;
    const results: Array<{
      intent: Intent;
      proofData: { destination: bigint; claimant: PublicKey };
    }> = [];

    // Process intents in batches
    for (let i = 0; i < intents.length; i += batchSize) {
      const batch = intents.slice(i, i + batchSize);

      // Derive PDAs for this batch
      const pdasWithIntents = batch.map((intent) => {
        const intentHashBytes = Buffer.from(intent.intentHash.slice(2), 'hex');
        const [proofPda] = ProofAccountMonitor.deriveProofPda(
          intentHashBytes,
          this.hyperProverProgramId!,
        );
        return { intent, proofPda };
      });

      // Batch query accounts
      const pdas = pdasWithIntents.map((item) => item.proofPda);
      const accounts = await this.connection.getMultipleAccountsInfo(pdas, 'confirmed');

      // Process results
      for (let j = 0; j < accounts.length; j++) {
        const accountInfo = accounts[j];
        const { intent, proofPda } = pdasWithIntents[j];

        if (accountInfo) {
          const proofData = await ProofAccountMonitor.getProofAccount(this.connection, proofPda);

          if (proofData) {
            results.push({ intent, proofData });
          }
        }
      }
    }

    return results;
  }
}
