import { Test, TestingModule } from '@nestjs/testing';

import * as api from '@opentelemetry/api';

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
    nonSwapTokens: {
      flatFee: 80,
      scalarBps: 40,
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
    nonSwapTokens: {
      flatFee: 150,
      scalarBps: 60,
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
    nonSwapTokens: {
      flatFee: 250,
      scalarBps: 90,
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

  describe('resolveTokenFee (hierarchy via destination token)', () => {
    const chainId = '1';
    const tokenAddress = '0x123...' as UniversalAddress;

    it('should return token fee when token has fee configured', () => {
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        fee: tokenFee,
      });

      const result = service.resolveTokenFee(chainId, tokenAddress);

      expect(result).toEqual(tokenFee.tokens);
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

      const result = service.resolveTokenFee(chainId, tokenAddress);

      expect(result).toEqual(networkFee.tokens);
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

      const result = service.resolveTokenFee(chainId, tokenAddress);

      expect(result).toEqual(defaultFee.tokens);
    });

    it('should handle no token address provided', () => {
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveTokenFee(chainId, undefined);

      expect(result).toEqual(networkFee.tokens);
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

      expect(() => service.resolveTokenFee(chainId, tokenAddress)).toThrow(
        `No fee configuration found for chain ${chainId}`,
      );
    });
  });

  describe('resolveNativeFee', () => {
    const chainId = '1';

    it('should return network fee for native transfers', () => {
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveNativeFee(chainId);

      expect(result).toEqual(networkFee.native);
      expect(blockchainConfigService.getFeeLogic).toHaveBeenCalledWith(chainId);
    });

    it('should return default fee when network fee not found', () => {
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });

      const result = service.resolveNativeFee(chainId);

      expect(result).toEqual(defaultFee.native);
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

      const result = service.resolveTokenFee(chainId, tokenAddress);

      expect(result).toEqual(tokenFee.tokens);
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

      const result = service.resolveTokenFee(chainId, tokenAddress);

      expect(result).toEqual(networkFee.tokens);
      // Should not use default fee since network fee was found
      expect(result).not.toEqual(defaultFee.tokens);
    });

    it('should demonstrate complete hierarchy: token > network > default', () => {
      // Test 1: Token fee available
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
        fee: tokenFee,
      });

      let result = service.resolveTokenFee(chainId, tokenAddress)!;
      expect(result.flatFee).toBe(300); // Token fee

      // Test 2: No token fee, network fee available
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: tokenAddress,
        decimals: 18,
        symbol: 'TOKEN',
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      result = service.resolveTokenFee(chainId, tokenAddress)!;
      expect(result.flatFee).toBe(200); // Network fee

      // Test 3: No token or network fee, default fee available
      blockchainConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('Not found');
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Not found');
      });

      result = service.resolveTokenFee(chainId, tokenAddress)!;
      expect(result.flatFee).toBe(100); // Default fee
    });
  });

  describe('resolveTokenFee (nonSwapGroups classification)', () => {
    const destinationChainId = '1';
    const sourceChainId = '10';
    const srcToken = '0xsrcToken...' as UniversalAddress;
    const dstToken = '0xdstToken...' as UniversalAddress;

    it('should return nonSwapTokens fee when nonSwapGroups match', () => {
      // Ensure base fee source is default (no token/network override)
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        return {} as any;
      });

      const result = service.resolveTokenFee(destinationChainId, dstToken, sourceChainId, srcToken);

      expect(result).toEqual(defaultFee.nonSwapTokens);
    });

    it('should return tokens fee when nonSwapGroups do not match', () => {
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['group-a'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['group-b'],
          } as any;
        }
        return {} as any;
      });

      const result = service.resolveTokenFee(destinationChainId, dstToken, sourceChainId, srcToken);

      expect(result).toEqual(defaultFee.tokens);
    });

    it('should use token override nonSwapTokens when groups match', () => {
      // Source token has groups, destination token has groups and token-level fee override
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['same-asset'],
            fee: tokenFee,
          } as any;
        }
        return {} as any;
      });

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(tokenFee.nonSwapTokens);
    });

    it('should use token override tokens when groups do not match', () => {
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['group-a'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['group-b'],
            fee: tokenFee,
          } as any;
        }
        return {} as any;
      });

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(tokenFee.tokens);
    });

    it('should use network fee nonSwapTokens when groups match and no token fee', () => {
      // No token fee override on destination; network fee available
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        return {} as any;
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(networkFee.nonSwapTokens);
    });

    it('should use network fee tokens when groups do not match and no token fee', () => {
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['group-a'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['group-b'],
          } as any;
        }
        return {} as any;
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(networkFee.tokens);
    });

    it('should fall back to tokens fee when one side missing nonSwapGroups', () => {
      // Source has groups, destination missing
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
          } as any;
        }
        return {} as any;
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(defaultFee.tokens);
    });

    it('should fall back to tokens fee when source missing nonSwapGroups', () => {
      // Destination has groups, source missing
      blockchainConfigService.getTokenConfig.mockImplementation((chainId, token) => {
        if (token === srcToken) {
          return {
            address: srcToken,
            decimals: 18,
            symbol: 'SRC',
          } as any;
        }
        if (token === dstToken) {
          return {
            address: dstToken,
            decimals: 18,
            symbol: 'DST',
            nonSwapGroups: ['same-asset'],
          } as any;
        }
        return {} as any;
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('Network not found');
      });

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(defaultFee.tokens);
    });
  });

  describe('tracing attributes', () => {
    const chainId = '1';
    const srcChainId = '10';
    const srcToken = '0xsrc' as UniversalAddress;
    const dstToken = '0xdst' as UniversalAddress;

    let span: { setAttributes: jest.Mock };
    let spanSpy: jest.SpiedFunction<typeof api.trace.getActiveSpan>;

    beforeEach(() => {
      span = {
        setAttributes: jest.fn(),
      } as any;
      spanSpy = jest.spyOn(api.trace, 'getActiveSpan').mockReturnValue(span as any);
    });

    afterEach(() => {
      spanSpy.mockRestore();
    });

    it('sets fee.source=token and fee.kind=tokens', () => {
      blockchainConfigService.getTokenConfig.mockReturnValueOnce({
        address: dstToken,
        decimals: 18,
        symbol: 'DST',
        fee: tokenFee,
      } as any);

      service.resolveTokenFee(chainId, dstToken);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'fee.source': 'token', 'fee.resolution.chainId': chainId }),
      );
      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'fee.kind': 'tokens', 'fee.nonSwapGroups.matched': false }),
      );
    });

    it('sets fee.source=network', () => {
      blockchainConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('not found');
      });
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      service.resolveTokenFee(chainId, dstToken);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'fee.source': 'network', 'fee.resolution.chainId': chainId }),
      );
    });

    it('sets fee.source=default when none found', () => {
      blockchainConfigService.getTokenConfig.mockImplementation(() => {
        throw new Error('not found');
      });
      blockchainConfigService.getFeeLogic.mockImplementation(() => {
        throw new Error('not found');
      });

      service.resolveTokenFee(chainId, dstToken);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'fee.source': 'default', 'fee.resolution.chainId': chainId }),
      );
    });

    it('sets fee.kind=nonSwapTokens when groups match', () => {
      blockchainConfigService.getTokenConfig.mockImplementation((id, token) => {
        if (token === srcToken) return { nonSwapGroups: ['g'] } as any;
        if (token === dstToken) return { nonSwapGroups: ['g'] } as any;
        return {} as any;
      });

      service.resolveTokenFee(chainId, dstToken, srcChainId, srcToken);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'fee.kind': 'nonSwapTokens', 'fee.nonSwapGroups.matched': true }),
      );
    });

    it('sets fee.kind=native and destinationChainId on resolveNativeFee', () => {
      blockchainConfigService.getFeeLogic.mockReturnValueOnce(networkFee);

      service.resolveNativeFee(chainId);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'fee.kind': 'native', 'fee.destinationChainId': chainId }),
      );
    });
  });

  describe('route-level overrides (exact 4-tuple)', () => {
    const destinationChainId = '1';
    const sourceChainId = '10';
    const srcToken = '0xsrc' as UniversalAddress;
    const dstToken = '0xdst' as UniversalAddress;

    beforeEach(() => {
      // Inject routeFeeOverrides into fulfillment config
      Object.defineProperty(fulfillmentConfigService, 'fulfillmentConfig', {
        get: jest.fn(() => ({
          defaultFee,
          routeFeeOverrides: [
            {
              sourceChainId: sourceChainId,
              destinationChainId: destinationChainId,
              sourceToken: srcToken,
              destinationToken: dstToken,
              fee: tokenFee,
            },
          ],
        })),
        configurable: true,
      });
    });

    it('should take precedence over token/network/default for tokens path', () => {
      // Set up non-matching nonSwapGroups so we select tokens branch
      blockchainConfigService.getTokenConfig.mockImplementation((id, token) => {
        if (token === srcToken) return { nonSwapGroups: ['a'] } as any;
        if (token === dstToken) return { nonSwapGroups: ['b'] } as any;
        return {} as any;
      });

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(tokenFee.tokens);
    });

    it('should select override.nonSwapTokens when groups match', () => {
      blockchainConfigService.getTokenConfig.mockImplementation((id, token) => {
        if (token === srcToken) return { nonSwapGroups: ['same'] } as any;
        if (token === dstToken) return { nonSwapGroups: ['same'] } as any;
        return {} as any;
      });

      const result = service.resolveTokenFee(
        destinationChainId,
        dstToken,
        sourceChainId,
        srcToken,
      )!;

      expect(result).toEqual(tokenFee.nonSwapTokens);
    });
  });
});
