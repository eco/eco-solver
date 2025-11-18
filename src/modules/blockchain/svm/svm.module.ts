import { forwardRef, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { EventsModule } from '@/modules/events/events.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { ProverModule } from '@/modules/prover/prover.module';
import { RedisModule } from '@/modules/redis/redis.module';

import { SolanaListener } from './listeners/solana.listener';
import { SvmListenersManagerService } from './listeners/svm-listeners-manager.service';
import { ProofAccountPollingService } from './services/proof-account-polling.service';
import { SvmExecutorService } from './services/svm.executor.service';
import { SvmReaderService } from './services/svm.reader.service';
import { SvmHyperProver } from './services/svm-hyper.prover';
import { SvmWalletManagerService } from './services/svm-wallet-manager.service';
import { BasicWalletModule } from './wallets/basic-wallet';
import { VaultWalletModule } from './wallets/vault-wallet';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    IntentsModule,
    BasicWalletModule,
    VaultWalletModule,
    EventsModule,
    OpenTelemetryModule,
    RedisModule,
    forwardRef(() => ProverModule),
  ],
  providers: [
    SvmExecutorService,
    SvmReaderService,
    SvmWalletManagerService,
    SolanaListener,
    SvmListenersManagerService,
    SvmHyperProver,
    ProofAccountPollingService,
  ],
  exports: [
    SvmExecutorService,
    SvmReaderService,
    SvmWalletManagerService,
    SolanaListener,
    SvmListenersManagerService,
  ],
})
export class SvmModule {}
