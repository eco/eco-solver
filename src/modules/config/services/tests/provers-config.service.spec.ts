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
      expect(mockConfigService.get).toHaveBeenCalledWith('provers.ccip');
    });

    it('should return undefined when CCIP not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(service.ccip).toBeUndefined();
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

    it('should return undefined when CCIP not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(service.getCcipChainSelector(1)).toBeUndefined();
    });
  });

  describe('getCcipGasLimit', () => {
    it('should return configured gas limit', () => {
      expect(service.getCcipGasLimit()).toBe(300000);
    });

    it('should return default gas limit when not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(service.getCcipGasLimit()).toBe(300000);
    });
  });

  describe('getCcipAllowOutOfOrderExecution', () => {
    it('should return configured flag', () => {
      expect(service.getCcipAllowOutOfOrderExecution()).toBe(true);
    });

    it('should return default flag when not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(service.getCcipAllowOutOfOrderExecution()).toBe(true);
    });
  });

  describe('getCcipDeadlineBuffer', () => {
    it('should return configured deadline buffer', () => {
      expect(service.getCcipDeadlineBuffer()).toBe(7200);
    });

    it('should return default deadline buffer when not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(service.getCcipDeadlineBuffer()).toBe(7200);
    });
  });
});
