import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LoggingModule } from '@/modules/logging/logging.module';
import { ProverService } from '@/modules/prover/prover.service';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [ProverService, HyperProver, MetalayerProver],
  exports: [ProverService],
})
export class ProverModule {}
