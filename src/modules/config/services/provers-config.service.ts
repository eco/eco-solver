import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CcipProverConfig } from '@/config/schemas';

/**
 * Configuration service for provers
 * Provides typed access to prover-specific configuration
 */
@Injectable()
export class ProversConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get the complete CCIP prover configuration
   */
  get ccip(): CcipProverConfig {
    return this.configService.get<CcipProverConfig>('provers.ccip')!;
  }

  /**
   * Get the CCIP chain selector for a specific chain ID
   * @param chainId - The chain ID to look up
   * @returns The CCIP chain selector string, or undefined if not configured
   */
  getCcipChainSelector(chainId: number): string | undefined {
    const ccipConfig = this.ccip;
    return ccipConfig.chainSelectors[chainId];
  }

  /**
   * Get the CCIP gas limit
   * @returns The configured gas limit, or default 300000
   */
  getCcipGasLimit(): number {
    return this.ccip.gasLimit;
  }

  /**
   * Get the CCIP allowOutOfOrderExecution flag
   * @returns The configured flag, or default true
   */
  getCcipAllowOutOfOrderExecution(): boolean {
    return this.ccip.allowOutOfOrderExecution;
  }

  /**
   * Get the CCIP deadline buffer in seconds
   * @returns The configured deadline buffer, or default 7200 (2 hours)
   */
  getCcipDeadlineBuffer(): number {
    return this.ccip.deadlineBuffer;
  }
}
