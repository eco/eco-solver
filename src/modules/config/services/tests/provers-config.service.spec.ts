import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { ProversConfigService } from '../provers-config.service';

describe('ProversConfigService', () => {
  let service: ProversConfigService;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockCcipConfig = {
    gasLimit: 300000,
    allowOutOfOrderExecution: true,
    deadlineBuffer: 7200,
    chainSelectors: {
      8453: '15971525489660198786',
      1: '5009297550715157269',
      2020: '6916147374840168594',
    },
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'provers.ccip') {
          return mockCcipConfig;
        }
        return undefined;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'provers.ccip') {
          return mockCcipConfig;
        }
        throw new Error(`Configuration key "${key}" does not exist`);
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProversConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ProversConfigService>(ProversConfigService);
  });

  describe('ccip getter', () => {
    it('should return CCIP configuration', () => {
      expect(service.ccip).toEqual(mockCcipConfig);
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('provers.ccip');
    });

    it('should throw error when CCIP not configured', () => {
      mockConfigService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "provers.ccip" does not exist');
      });
      expect(() => service.ccip).toThrow('Configuration key "provers.ccip" does not exist');
    });
  });

  describe('getCcipChainSelector', () => {
    it('should return chain selector for Base (8453)', () => {
      expect(service.getCcipChainSelector(8453)).toBe('15971525489660198786');
    });

    it('should return chain selector for Ethereum (1)', () => {
      expect(service.getCcipChainSelector(1)).toBe('5009297550715157269');
    });

    it('should return chain selector for Ronin (2020)', () => {
      expect(service.getCcipChainSelector(2020)).toBe('6916147374840168594');
    });

    it('should return undefined for unconfigured chain', () => {
      expect(service.getCcipChainSelector(999)).toBeUndefined();
    });

    it('should throw error when CCIP not configured', () => {
      mockConfigService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "provers.ccip" does not exist');
      });
      expect(() => service.getCcipChainSelector(1)).toThrow('Configuration key "provers.ccip" does not exist');
    });
  });

  describe('getCcipGasLimit', () => {
    it('should return configured gas limit', () => {
      expect(service.getCcipGasLimit()).toBe(300000);
    });

    it('should throw error when CCIP not configured', () => {
      mockConfigService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "provers.ccip" does not exist');
      });
      expect(() => service.getCcipGasLimit()).toThrow('Configuration key "provers.ccip" does not exist');
    });
  });

  describe('getCcipAllowOutOfOrderExecution', () => {
    it('should return configured flag', () => {
      expect(service.getCcipAllowOutOfOrderExecution()).toBe(true);
    });

    it('should throw error when CCIP not configured', () => {
      mockConfigService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "provers.ccip" does not exist');
      });
      expect(() => service.getCcipAllowOutOfOrderExecution()).toThrow('Configuration key "provers.ccip" does not exist');
    });
  });

  describe('getCcipDeadlineBuffer', () => {
    it('should return configured deadline buffer', () => {
      expect(service.getCcipDeadlineBuffer()).toBe(7200);
    });

    it('should throw error when CCIP not configured', () => {
      mockConfigService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration key "provers.ccip" does not exist');
      });
      expect(() => service.getCcipDeadlineBuffer()).toThrow('Configuration key "provers.ccip" does not exist');
    });
  });
});
