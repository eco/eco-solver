import { Test, TestingModule } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { BlockchainConfigService } from '@/modules/config/services/blockchain-config.service';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

describe('FeeResolverService', () => {
  let service: FeeResolverService;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let fulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;

  const defaultFee: AssetsFeeSchemaType = {
    tokens: {
      flatFee: 100,
      scalarBps: 50,
    },
    native: {
      flatFee: 50,
      scalarBps: 25,
    },
  };

  const networkFee: AssetsFeeSchemaType = {
    tokens: {
      flatFee: 200,
      scalarBps: 75,
    },
    native: {
      flatFee: 100,
      scalarBps: 40,
    },
  };

  const tokenFee: AssetsFeeSchemaType = {
    tokens: {
      flatFee: 300,
      scalarBps: 100,
    },
    native: {
      flatFee: 150,
      scalarBps: 60,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeResolverService,
        {
          provide: BlockchainConfigService,
          useValue: {
            getTokenConfig: jest.fn(),
            getFeeLogic: jest.fn(),
          },
        },
        {
          provide: FulfillmentConfigService,
          useValue: {
            fulfillmentConfig: {
              defaultFee,
            },
          },
        },
      ],
    }).compile();

    service = module.get<FeeResolverService>(FeeResolverService);
    blockchainConfigService = module.get(BlockchainConfigService);
    fulfillmentConfigService = module.get(FulfillmentConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveFee', () => {
    const chainId = '1';
    const tokenAddress = '0x123...' as UniversalAddress;

    it('should return token fee when token has fee configured', () => {
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        fee: tokenFee,
      });

      const result = service.resolveFee(chainId, tokenAddress);

      expect(result).toEqual(tokenFee);
      expect(blockchainConfigService.getTokenConfig).toHaveBeenCalledWith(chainId, tokenAddress);
    });

    it('should return network fee when no token fee is configured', () => {
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        // No fee field
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveFee(chainId, tokenAddress);

      expect(result).toEqual(networkFee);
      expect(blockchainConfigService.getTokenConfig).toHaveBeenCalledWith(chainId, tokenAddress);
      expect(blockchainConfigService.getFeeLogic).toHaveBeenCalledWith(chainId);
    });

    it('should return default fee when no token or network fee is configured', () => {
      blockchainConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('Token not found');
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });

      const result = service.resolveFee(chainId, tokenAddress);

      expect(result).toEqual(defaultFee);
    });

    it('should handle no token address provided', () => {
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveFee(chainId, undefined);

      expect(result).toEqual(networkFee);
      expect(blockchainConfigService.getTokenConfig).not.toHaveBeenCalled();
      expect(blockchainConfigService.getFeeLogic).toHaveBeenCalledWith(chainId);
    });

    it('should throw error when no fee configuration found at any level', () => {
      blockchainConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('Token not found');
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });

      // Mock no default fee
      Object.defineProperty(fulfillmentConfigService, 'fulfillmentConfig', {
        get: jest.fn(() => ({})),
        configurable: true,
      });

      expect(() => service.resolveFee(chainId, tokenAddress)).toThrow(
        `No fee configuration found for chain ${chainId}`,
      );
    });
  });

  describe('resolveNativeFee', () => {
    const chainId = '1';

    it('should return network fee for native transfers', () => {
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveNativeFee(chainId);

      expect(result).toEqual(networkFee);
      expect(blockchainConfigService.getFeeLogic).toHaveBeenCalledWith(chainId);
    });

    it('should return default fee when network fee not found', () => {
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });

      const result = service.resolveNativeFee(chainId);

      expect(result).toEqual(defaultFee);
    });

    it('should not check token fees for native transfers', () => {
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      service.resolveNativeFee(chainId);

      expect(blockchainConfigService.getTokenConfig).not.toHaveBeenCalled();
    });
  });

  describe('Fee Hierarchy Priority', () => {
    const chainId = '1';
    const tokenAddress = '0x123...' as UniversalAddress;

    it('should prioritize token fee over network fee', () => {
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        fee: tokenFee,
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveFee(chainId, tokenAddress);

      expect(result).toEqual(tokenFee);
      // Should not call getFeeLogic since token fee was found
      expect(blockchainConfigService.getFeeLogic).not.toHaveBeenCalled();
    });

    it('should prioritize network fee over default fee', () => {
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        // No fee
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveFee(chainId, tokenAddress);

      expect(result).toEqual(networkFee);
      // Should not use default fee since network fee was found
      expect(result).not.toEqual(defaultFee);
    });

    it('should demonstrate complete hierarchy: token > network > default', () => {
      // Test 1: Token fee available
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        fee: tokenFee,
      });

      let result = service.resolveFee(chainId, tokenAddress);
      expect(result.tokens.flatFee).toBe(300); // Token fee

      // Test 2: No token fee, network fee available
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      result = service.resolveFee(chainId, tokenAddress);
      expect(result.tokens.flatFee).toBe(200); // Network fee

      // Test 3: No token or network fee, default fee available
      blockchainConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('Not found');
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Not found');
      });

      result = service.resolveFee(chainId, tokenAddress);
      expect(result.tokens.flatFee).toBe(100); // Default fee
    });
  });
});
