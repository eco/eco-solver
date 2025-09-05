import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LoggingModule } from '@/modules/logging/logging.module';
import { ProverService } from '@/modules/prover/prover.service';
import { DummyProver } from '@/modules/prover/provers/dummy.prover';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';
import { PolymerProver } from '@/modules/prover/provers/polymer.prover';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [ProverService, HyperProver, PolymerProver, MetalayerProver, DummyProver],
  exports: [ProverService],
})
export class ProverModule {}
