import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { ProverService } from '@/modules/prover/prover.service';
import { CcipProver } from '@/modules/prover/provers/ccip.prover';
import { DummyProver } from '@/modules/prover/provers/dummy.prover';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';
import { PolymerProver } from '@/modules/prover/provers/polymer.prover';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule, OpenTelemetryModule],
  providers: [ProverService, HyperProver, PolymerProver, MetalayerProver, DummyProver, CcipProver],
  exports: [ProverService],
})
export class ProverModule {}
