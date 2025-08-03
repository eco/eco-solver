import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ProverService } from '@/modules/prover/prover.service';
import { ProverConfigService } from '@/modules/prover/prover-config.service';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';

@Module({
  imports: [ConfigModule],
  providers: [ProverService, ProverConfigService, HyperProver, MetalayerProver],
  exports: [ProverService],
})
export class ProverModule {}
