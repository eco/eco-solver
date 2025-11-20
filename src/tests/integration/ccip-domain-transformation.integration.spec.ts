import { ModuleRef } from '@nestjs/core';

import { decodeAbiParameters } from 'viem';

import { CcipProverConfig } from '@/config/schemas/provers.schema';
import { BlockchainConfigService, ProversConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { CcipProver } from '@/modules/prover/provers/ccip.prover';

describe('CCIP Domain Transformation Integration', () => {
  let ccipProver: CcipProver;
  let mockProversConfigService: jest.Mocked<ProversConfigService>;

  const ccipConfig: CcipProverConfig = {
    gasLimit: 300000,
    allowOutOfOrderExecution: true,
    deadlineBuffer: 7200,
    chainSelectors: {
      8453: '15971525489660198786', // Base
      1: '5009297550715157269', // Ethereum
      2020: '6916147374840168594', // Ronin
      10: '3734403246176062136', // Optimism
    },
  };

  beforeAll(async () => {
    mockProversConfigService = {
      getCcipChainSelector: jest.fn().mockImplementation((chainId: number) => {
        return ccipConfig.chainSelectors[chainId];
      }),
      getCcipGasLimit: jest.fn().mockReturnValue(ccipConfig.gasLimit),
      getCcipAllowOutOfOrderExecution: jest
        .fn()
        .mockReturnValue(ccipConfig.allowOutOfOrderExecution),
      getCcipDeadlineBuffer: jest.fn().mockReturnValue(ccipConfig.deadlineBuffer),
      ccip: ccipConfig,
    } as unknown as jest.Mocked<ProversConfigService>;

    const mockBlockchainConfigService = {} as jest.Mocked<BlockchainConfigService>;
    const mockModuleRef = {} as jest.Mocked<ModuleRef>;

    ccipProver = new CcipProver(
      mockBlockchainConfigService,
      mockModuleRef,
      mockProversConfigService,
    );
  });

  it('should transform Base chain ID to CCIP chain selector', () => {
    const domainId = ccipProver.getDomainId(8453);
    expect(domainId).toBe(15971525489660198786n);
  });

  it('should transform Ethereum chain ID to CCIP chain selector', () => {
    const domainId = ccipProver.getDomainId(1);
    expect(domainId).toBe(5009297550715157269n);
  });

  it('should transform Optimism chain ID to CCIP chain selector', () => {
    const domainId = ccipProver.getDomainId(10);
    expect(domainId).toBe(3734403246176062136n);
  });

  it('should include chain selector in generated proof', async () => {
    const mockIntent = createMockIntent({
      sourceChainId: 8453n, // Base
      destination: 1n, // Ethereum
    });

    const proof = await ccipProver.generateProof(mockIntent);

    // Decode and verify first parameter is chain selector, not chain ID
    const decoded = decodeAbiParameters(
      [{ type: 'tuple', components: [{ type: 'uint64' }, { type: 'uint256' }, { type: 'bool' }] }],
      proof,
    );

    expect(decoded[0][0]).toBe(15971525489660198786n); // Chain selector for Base
    expect(decoded[0][0]).not.toBe(8453n); // NOT the chain ID
  });

  it('should throw error for unconfigured chain', () => {
    expect(() => ccipProver.getDomainId(999)).toThrow(
      'No CCIP chain selector configured for chain 999',
    );
  });

  it('should use chain selector from different source chains', async () => {
    const testCases = [
      { sourceChainId: 8453n, expectedSelector: 15971525489660198786n }, // Base
      { sourceChainId: 1n, expectedSelector: 5009297550715157269n }, // Ethereum
      { sourceChainId: 10n, expectedSelector: 3734403246176062136n }, // Optimism
    ];

    for (const { sourceChainId, expectedSelector } of testCases) {
      const intent = createMockIntent({
        sourceChainId,
        destination: 1n,
      });

      const proof = await ccipProver.generateProof(intent);
      const decoded = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [{ type: 'uint64' }, { type: 'uint256' }, { type: 'bool' }],
          },
        ],
        proof,
      );

      expect(decoded[0][0]).toBe(expectedSelector);
    }
  });
});
