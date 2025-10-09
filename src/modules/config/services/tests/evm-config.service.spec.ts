import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { EvmNetworkConfig } from '@/config/schemas';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';

describe('EvmConfigService', () => {
  let service: EvmConfigService;

  const mockNetworks: EvmNetworkConfig[] = [
    {
      chainId: 1,
      rpc: {
        urls: ['https://mainnet.infura.io'],
        options: {},
      },
      tokens: [],
      fee: {
        tokens: {
          flatFee: 1000000000000000,
          scalarBps: 100,
        },
        nonSwapTokens: {
          flatFee: 1000000000000000,
          scalarBps: 100,
        },
      },
      provers: {
        hyper: '0x3333333333333333333333333333333333333333',
        metalayer: '0x4444444444444444444444444444444444444444',
      },
      defaultProver: 'hyper',
      contracts: {
        portal: '0x1111111111111111111111111111111111111111',
      },
      claimant: '0x2222222222222222222222222222222222222222',
    },
    {
      chainId: 10,
      rpc: {
        urls: ['https://optimism.infura.io'],
        options: {},
      },
      tokens: [],
      fee: {
        tokens: {
          flatFee: 500000000000000,
          scalarBps: 50,
        },
        nonSwapTokens: {
          flatFee: 500000000000000,
          scalarBps: 50,
        },
      },
      provers: {
        hyper: '0x7777777777777777777777777777777777777777',
      },
      defaultProver: 'hyper',
      contracts: {
        portal: '0x5555555555555555555555555555555555555555',
      },
      claimant: '0x6666666666666666666666666666666666666666',
    },
  ];

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EvmConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'evm.networks') {
                return mockNetworks;
              }
              if (key === 'evm.wallets') {
                return {};
              }
              if (key === 'evm') {
                return { networks: mockNetworks, wallets: {} };
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EvmConfigService>(EvmConfigService);
  });

  describe('getPortalAddress', () => {
    it('should return the portal address for a valid chain', () => {
      const address = service.getPortalAddress(1);
      expect(address).toBe('0x0000000000000000000000001111111111111111111111111111111111111111');
    });

    it('should return the portal address for another chain', () => {
      const address = service.getPortalAddress(10);
      expect(address).toBe('0x0000000000000000000000005555555555555555555555555555555555555555');
    });

    it('should throw an error for an invalid chain', () => {
      expect(() => service.getPortalAddress(999)).toThrow(
        'Network configuration not found for chainId: 999',
      );
    });
  });

  describe('getProverAddress', () => {
    it('should return the hyper prover address for chain 1', () => {
      const address = service.getProverAddress(1, 'hyper');
      expect(address).toBe('0x0000000000000000000000003333333333333333333333333333333333333333');
    });

    it('should return the metalayer prover address for chain 1', () => {
      const address = service.getProverAddress(1, 'metalayer');
      expect(address).toBe('0x0000000000000000000000004444444444444444444444444444444444444444');
    });

    it('should return the hyper prover address for chain 10', () => {
      const address = service.getProverAddress(10, 'hyper');
      expect(address).toBe('0x0000000000000000000000007777777777777777777777777777777777777777');
    });

    it('should return undefined for metalayer prover on chain 10', () => {
      const address = service.getProverAddress(10, 'metalayer');
      expect(address).toBeUndefined();
    });

    it('should throw an error for an invalid chain', () => {
      expect(() => service.getProverAddress(999, 'hyper')).toThrow(
        'Network configuration not found for chainId: 999',
      );
    });
  });

  describe('existing methods', () => {
    it('should get network configuration', () => {
      const network = service.getChain(1);
      expect(network.chainId).toBe(1);
      expect(network.contracts.portal).toBe('0x1111111111111111111111111111111111111111');
    });

    it('should get supported chain IDs', () => {
      const chainIds = service.supportedChainIds;
      expect(chainIds).toEqual([1, 10]);
    });

    it('should check if configured', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });
});
