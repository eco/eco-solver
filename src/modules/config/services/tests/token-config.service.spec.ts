import { Test, TestingModule } from '@nestjs/testing';

import { toUniversalAddress } from '@/common/types/universal-address.type';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { SolanaConfigService } from '@/modules/config/services/solana-config.service';
import { TvmConfigService } from '@/modules/config/services/tvm-config.service';

import { TokenConfigService } from '../token-config.service';

describe('TokenConfigService', () => {
  let service: TokenConfigService;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let tvmConfigService: jest.Mocked<TvmConfigService>;
  let solanaConfigService: jest.Mocked<SolanaConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenConfigService,
        {
          provide: EvmConfigService,
          useValue: {
            isTokenSupported: jest.fn(),
            getTokenConfig: jest.fn(),
            getSupportedTokens: jest.fn(),
          },
        },
        {
          provide: TvmConfigService,
          useValue: {
            isTokenSupported: jest.fn(),
            getTokenConfig: jest.fn(),
            getSupportedTokens: jest.fn(),
          },
        },
        {
          provide: SolanaConfigService,
          useValue: {
            isTokenSupported: jest.fn().mockReturnValue(true),
            getTokenConfig: jest.fn(),
            getSupportedTokens: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<TokenConfigService>(TokenConfigService);
    evmConfigService = module.get(EvmConfigService);
    tvmConfigService = module.get(TvmConfigService);
    solanaConfigService = module.get(SolanaConfigService);
  });

  describe('isTokenSupported', () => {
    it('should check EVM token support for EVM chain', () => {
      evmConfigService.isTokenSupported.mockReturnValue(true);

      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123');
      const result = service.isTokenSupported(1, address);

      expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(1, address);
      expect(result).toBe(true);
    });

    it('should check TVM token support for TVM chain', () => {
      tvmConfigService.isTokenSupported.mockReturnValue(true);

      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000005441646472657373');
      const result = service.isTokenSupported(728126428, address);

      expect(tvmConfigService.isTokenSupported).toHaveBeenCalledWith(728126428, address);
      expect(result).toBe(true);
    });

    it('should return true for SVM chains (no restrictions)', () => {
      // Use a proper 32-byte Solana-like address
      const address = toUniversalAddress('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      const result = service.isTokenSupported('solana-mainnet', address);

      expect(result).toBe(true);
    });

    it('should return false for unsupported chain types', () => {
      // 999999999 passes the EVM heuristic check, so mock EVM service to return false
      evmConfigService.isTokenSupported.mockReturnValue(false);

      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123');
      const result = service.isTokenSupported(999999999, address);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      evmConfigService.isTokenSupported.mockImplementation(() => {
        throw new Error('Config error');
      });

      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123');
      const result = service.isTokenSupported(1, address);

      expect(result).toBe(false);
    });
  });

  describe('getTokenConfig', () => {
    it('should get EVM token config', () => {
      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123');
      const mockToken = {
        address: address,
        decimals: 18,
        limit: { min: 1, max: 1000 },
      };
      evmConfigService.getTokenConfig.mockReturnValue(mockToken);

      const result = service.getTokenConfig(1, address);

      expect(evmConfigService.getTokenConfig).toHaveBeenCalledWith(1, address);
      expect(result).toEqual({
        address: address,
        decimals: 18,
        limit: { min: 1, max: 1000 },
      });
    });

    it('should handle backward compatible EVM token limit (single number)', () => {
      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123');
      const mockToken = {
        address: address,
        decimals: 18,
        limit: 1000,
      };
      evmConfigService.getTokenConfig.mockReturnValue(mockToken);

      const result = service.getTokenConfig(1, address);

      expect(result).toEqual({
        address: address,
        decimals: 18,
        limit: { max: 1000 },
      });
    });

    it('should get TVM token config', () => {
      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000005441646472657373');
      const mockToken = {
        address: address,
        decimals: 6,
        limit: { min: 10, max: 5000 },
      };
      tvmConfigService.getTokenConfig.mockReturnValue(mockToken);

      const result = service.getTokenConfig(728126428, address);

      expect(tvmConfigService.getTokenConfig).toHaveBeenCalledWith(728126428, address);
      expect(result).toEqual({
        address: address,
        decimals: 6,
        limit: { min: 10, max: 5000 },
      });
    });

    it('should return default config for SVM tokens', () => {
      const address = toUniversalAddress('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      
      solanaConfigService.getTokenConfig.mockReturnValue({
        address: address,
        decimals: 9,
      });

      const result = service.getTokenConfig('solana-mainnet', address);

      expect(result).toEqual({
        address: address,
        decimals: 9,
      });
    });

    it('should throw error for unsupported chain', () => {
      // 999999999 passes the EVM heuristic check, so mock EVM service to throw
      evmConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('Network configuration not found for chainId: 999999999');
      });

      const address = toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123');
      expect(() => service.getTokenConfig(999999999, address)).toThrow(
        'Network configuration not found for chainId: 999999999',
      );
    });
  });

  describe('getSupportedTokens', () => {
    it('should get EVM supported tokens', () => {
      const mockTokens = [
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123'), decimals: 18 },
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000456'), decimals: 6 },
      ];
      evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

      const result = service.getSupportedTokens(1);

      expect(evmConfigService.getSupportedTokens).toHaveBeenCalledWith(1);
      expect(result).toEqual([
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000123'), decimals: 18 },
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000000000000000000456'), decimals: 6 },
      ]);
    });

    it('should get TVM supported tokens', () => {
      const mockTokens = [
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000005441646472657373'), decimals: 6 },
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000005441646472657374'), decimals: 8 },
      ];
      tvmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

      const result = service.getSupportedTokens(728126428);

      expect(tvmConfigService.getSupportedTokens).toHaveBeenCalledWith(728126428);
      expect(result).toEqual([
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000005441646472657373'), decimals: 6 },
        { address: toUniversalAddress('0x0000000000000000000000000000000000000000000000005441646472657374'), decimals: 8 },
      ]);
    });

    it('should return empty array for SVM (no restrictions)', () => {
      const result = service.getSupportedTokens('solana-mainnet');

      expect(result).toEqual([]);
    });

    it('should return empty array for unsupported chains', () => {
      const result = service.getSupportedTokens(999999999);

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', () => {
      evmConfigService.getSupportedTokens.mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = service.getSupportedTokens(1);

      expect(result).toEqual([]);
    });
  });
});
