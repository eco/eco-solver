import { Injectable } from '@nestjs/common';

import { ProverResult, ProverRoute } from '@/common/interfaces/prover.interface';

@Injectable()
export abstract class BaseProver {
  abstract readonly type: string;
  
  abstract validateRoute(route: ProverRoute): Promise<ProverResult>;
  
  abstract getContractAddress(chainId: string | number): string | undefined;
  
  abstract isSupported(chainId: string | number): boolean;
}