import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ProverService } from '@/modules/prover/prover.service';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';

@Module({
  imports: [ConfigModule],
  providers: [ProverService, HyperProver, MetalayerProver],
  exports: [ProverService],
})
export class ProverModule {}
