import { Test, TestingModule } from '@nestjs/testing';

import { getAddress } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { RhinestoneConfigService } from '../../../config/services/rhinestone-config.service';
import { RhinestoneContractsService } from '../rhinestone-contracts.service';
import { RhinestoneValidationService } from '../rhinestone-validation.service';

describe('RhinestoneValidationService', () => {
  let service: RhinestoneValidationService;
  let contractsService: jest.Mocked<RhinestoneContractsService>;
  let feeResolverService: jest.Mocked<FeeResolverService>;
  let tokenConfigService: jest.Mocked<TokenConfigService>;

  const mockContracts = {
    router: '0x000000000004598d17aad017bf0734a364c5588b',
    ecoAdapter: '0x0000000000000000000000000000000000000001',
    ecoArbiter: '0x0000000000000000000000000000000000000002',
  };

  const mockFeeConfig = {
    tokens: {
      flatFee: 0.5, // 0.5 USD base fee
      scalarBps: 30, // 0.3% fee (30 basis points)
    },
  };

  beforeEach(async () => {
    const mockContractsService = {
      getAdapter: jest.fn(),
      getArbiter: jest.fn(),
    };

    const mockConfigService = {
      getContracts: jest.fn().mockReturnValue(mockContracts),
    };

    const mockFeeResolver = {
      resolveFee: jest.fn().mockReturnValue(mockFeeConfig),
    };

    const mockTokenConfig = {
      normalize: jest.fn().mockImplementation((chainId, tokens) => {
        // Mock normalization - just return the tokens with decimals added
        if (Array.isArray(tokens)) {
          return tokens.map((t) => ({ token: t.token, decimals: 18, amount: t.amount }));
        }
        return { token: tokens.token, decimals: 18, amount: tokens.amount };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RhinestoneValidationService,
        {
          provide: RhinestoneContractsService,
          useValue: mockContractsService,
        },
        {
          provide: RhinestoneConfigService,
          useValue: mockConfigService,
        },
        {
          provide: FeeResolverService,
          useValue: mockFeeResolver,
        },
        {
          provide: TokenConfigService,
          useValue: mockTokenConfig,
        },
      ],
    }).compile();

    service = module.get<RhinestoneValidationService>(RhinestoneValidationService);
    contractsService = module.get(RhinestoneContractsService);
    feeResolverService = module.get(FeeResolverService);
    tokenConfigService = module.get(TokenConfigService);

    jest.clearAllMocks();
  });

  describe('Payload Validations', () => {
    describe('validateSettlementLayerFromMetadata', () => {
      it('should pass for ECO settlement layer', () => {
        expect(() => {
          service.validateSettlementLayerFromMetadata({ settlementLayer: 'ECO' });
        }).not.toThrow();
      });

      it('should throw Error for missing settlement layer', () => {
        expect(() => {
          service.validateSettlementLayerFromMetadata({});
        }).toThrow('Settlement layer not specified in claim metadata');
      });

      it('should throw Error for undefined metadata', () => {
        expect(() => {
          service.validateSettlementLayerFromMetadata(undefined);
        }).toThrow('Settlement layer not specified in claim metadata');
      });

      it('should throw ValidationError for non-ECO settlement layer', () => {
        expect(() => {
          service.validateSettlementLayerFromMetadata({ settlementLayer: 'ACROSS' });
        }).toThrow(ValidationError);

        try {
          service.validateSettlementLayerFromMetadata({ settlementLayer: 'ACROSS' });
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Unsupported settlement layer: ACROSS',
          );
        }
      });
    });

    describe('validateSettlementLayer', () => {
      it('should pass for ECO settlement layer', () => {
        expect(() => {
          service.validateSettlementLayer('ECO');
        }).not.toThrow();
      });

      it('should throw ValidationError for non-ECO settlement layer', () => {
        expect(() => {
          service.validateSettlementLayer('ACROSS');
        }).toThrow(ValidationError);

        try {
          service.validateSettlementLayer('ACROSS');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Unsupported settlement layer: ACROSS',
          );
        }
      });
    });

    describe('validateRouterAddress', () => {
      it('should pass for valid router address', () => {
        expect(() => {
          service.validateRouterAddress(mockContracts.router, 1);
        }).not.toThrow();
      });

      it('should throw ValidationError for invalid router address', () => {
        const invalidRouter = '0x0000000000000000000000000000000000000099';

        expect(() => {
          service.validateRouterAddress(invalidRouter, 1);
        }).toThrow(ValidationError);

        try {
          service.validateRouterAddress(invalidRouter, 1);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Invalid router address');
          expect((error as ValidationError).message).toContain(getAddress(mockContracts.router));
          expect((error as ValidationError).message).toContain(getAddress(invalidRouter));
        }
      });

      it('should handle checksum address validation', () => {
        // Lowercase version of valid router should still work (viem will normalize)
        const lowercaseRouter = mockContracts.router.toLowerCase();
        expect(() => {
          service.validateRouterAddress(lowercaseRouter, 1);
        }).not.toThrow();
      });
    });

    describe('validateZeroValue', () => {
      it('should pass for "0" string value', () => {
        expect(() => {
          service.validateZeroValue('0');
        }).not.toThrow();
      });

      it('should pass for "0x0" hex value', () => {
        expect(() => {
          service.validateZeroValue('0x0');
        }).not.toThrow();
      });

      it('should pass for 0n bigint', () => {
        expect(() => {
          service.validateZeroValue(0n);
        }).not.toThrow();
      });

      it('should throw ValidationError for non-zero string value', () => {
        expect(() => {
          service.validateZeroValue('100');
        }).toThrow(ValidationError);

        try {
          service.validateZeroValue('100');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Router call must have zero value');
        }
      });

      it('should throw ValidationError for non-zero bigint value', () => {
        expect(() => {
          service.validateZeroValue(100n);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for non-zero hex value', () => {
        expect(() => {
          service.validateZeroValue('0x64'); // 100 in hex
        }).toThrow(ValidationError);
      });
    });

    describe('validateDifferentChains', () => {
      it('should pass for different chains', () => {
        expect(() => {
          service.validateDifferentChains(1, 10);
        }).not.toThrow();
      });

      it('should throw ValidationError for same chains', () => {
        expect(() => {
          service.validateDifferentChains(1, 1);
        }).toThrow(ValidationError);

        try {
          service.validateDifferentChains(1, 1);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Source and destination chains must be different',
          );
          expect((error as ValidationError).message).toContain('Both are chain 1');
        }
      });
    });

    describe('validateActionIntegrity', () => {
      const validClaimCall = {
        to: mockContracts.router,
        chainId: 1,
        value: '0',
      };

      const validFillCall = {
        to: mockContracts.router,
        chainId: 10,
        value: '0',
      };

      it('should pass for valid action', () => {
        expect(() => {
          service.validateActionIntegrity(validClaimCall, validFillCall);
        }).not.toThrow();
      });

      it('should throw ValidationError for invalid claim router', () => {
        const invalidClaimCall = {
          ...validClaimCall,
          to: '0x0000000000000000000000000000000000000099',
        };

        expect(() => {
          service.validateActionIntegrity(invalidClaimCall, validFillCall);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid fill router', () => {
        const invalidFillCall = {
          ...validFillCall,
          to: '0x0000000000000000000000000000000000000099',
        };

        expect(() => {
          service.validateActionIntegrity(validClaimCall, invalidFillCall);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for non-zero claim value', () => {
        const nonZeroClaimCall = {
          ...validClaimCall,
          value: '100',
        };

        expect(() => {
          service.validateActionIntegrity(nonZeroClaimCall, validFillCall);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for non-zero fill value', () => {
        const nonZeroFillCall = {
          ...validFillCall,
          value: '100',
        };

        expect(() => {
          service.validateActionIntegrity(validClaimCall, nonZeroFillCall);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for same chains', () => {
        const sameChainFillCall = {
          ...validFillCall,
          chainId: 1,
        };

        expect(() => {
          service.validateActionIntegrity(validClaimCall, sameChainFillCall);
        }).toThrow(ValidationError);
      });

      it('should throw Error for invalid claim value format', () => {
        const invalidClaimCall = {
          ...validClaimCall,
          value: 'not-a-number',
        };

        expect(() => {
          service.validateActionIntegrity(invalidClaimCall, validFillCall);
        }).toThrow('Invalid claim value format');
      });

      it('should throw Error for invalid fill value format', () => {
        const invalidFillCall = {
          ...validFillCall,
          value: 'not-a-number',
        };

        expect(() => {
          service.validateActionIntegrity(validClaimCall, invalidFillCall);
        }).toThrow('Invalid fill value format');
      });
    });
  });

  describe('Execution Validations', () => {
    describe('validateAdapterAndArbiter', () => {
      it('should pass for valid adapter and arbiter addresses', async () => {
        contractsService.getAdapter.mockResolvedValue(getAddress(mockContracts.ecoAdapter));
        contractsService.getArbiter.mockResolvedValue(getAddress(mockContracts.ecoArbiter));

        await expect(
          service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          ),
        ).resolves.not.toThrow();

        expect(contractsService.getAdapter).toHaveBeenCalledWith(
          1,
          getAddress(mockContracts.router),
          'claim',
          '0x12345678',
        );
        expect(contractsService.getArbiter).toHaveBeenCalledWith(
          1,
          getAddress(mockContracts.ecoAdapter),
        );
      });

      it('should throw ValidationError for invalid adapter address', async () => {
        const invalidAdapter = '0x0000000000000000000000000000000000000099';
        contractsService.getAdapter.mockResolvedValue(getAddress(invalidAdapter));

        await expect(
          service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          ),
        ).rejects.toThrow(ValidationError);

        try {
          await service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Invalid adapter address');
        }
      });

      it('should throw ValidationError for invalid arbiter address', async () => {
        const invalidArbiter = '0x0000000000000000000000000000000000000099';
        contractsService.getAdapter.mockResolvedValue(getAddress(mockContracts.ecoAdapter));
        contractsService.getArbiter.mockResolvedValue(getAddress(invalidArbiter));

        await expect(
          service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          ),
        ).rejects.toThrow(ValidationError);

        try {
          await service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Invalid arbiter address');
        }
      });

      it('should skip validation during quoting mode', async () => {
        await expect(
          service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
            {
              skipOnChain: true,
            },
          ),
        ).resolves.not.toThrow();

        expect(contractsService.getAdapter).not.toHaveBeenCalled();
        expect(contractsService.getArbiter).not.toHaveBeenCalled();
      });

      it('should wrap network errors as TEMPORARY ValidationErrors', async () => {
        contractsService.getAdapter.mockRejectedValue(new Error('Network error'));

        await expect(
          service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          ),
        ).rejects.toThrow(ValidationError);

        try {
          await service.validateAdapterAndArbiter(
            1,
            getAddress(mockContracts.router),
            'claim',
            '0x12345678',
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.TEMPORARY);
          expect((error as ValidationError).message).toContain(
            'Failed to validate adapter/arbiter',
          );
          expect((error as ValidationError).message).toContain('Network error');
        }
      });
    });

    describe('validateIntentHashMatch', () => {
      it('should pass when claim hash is in fill hashes', () => {
        const fillHashes = ['0xabc123', '0xdef456', '0x789ghi'];
        const claimHash = '0xdef456';

        expect(() => {
          service.validateIntentHashMatch(fillHashes, claimHash);
        }).not.toThrow();
      });

      it('should throw ValidationError when claim hash not in fill hashes', () => {
        const fillHashes = ['0xabc123', '0xdef456', '0x789ghi'];
        const claimHash = '0xnotfound';

        expect(() => {
          service.validateIntentHashMatch(fillHashes, claimHash);
        }).toThrow(ValidationError);

        try {
          service.validateIntentHashMatch(fillHashes, claimHash);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Intent hash for fill and claim do not match',
          );
        }
      });

      it('should handle empty fill hashes array', () => {
        expect(() => {
          service.validateIntentHashMatch([], '0xabc123');
        }).toThrow(ValidationError);
      });
    });

    describe('validateFunctionName', () => {
      it('should pass for routeFill when expected', () => {
        expect(() => {
          service.validateFunctionName('routeFill', 'routeFill');
        }).not.toThrow();
      });

      it('should pass for routeClaim when expected', () => {
        expect(() => {
          service.validateFunctionName('routeClaim', 'routeClaim');
        }).not.toThrow();
      });

      it('should throw ValidationError for mismatched function name', () => {
        expect(() => {
          service.validateFunctionName('routeFill', 'routeClaim');
        }).toThrow(ValidationError);

        try {
          service.validateFunctionName('routeFill', 'routeClaim');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Expected routeClaim, got routeFill',
          );
        }
      });
    });

    describe('validateRouteCallCount', () => {
      it('should pass for non-zero call count', () => {
        expect(() => {
          service.validateRouteCallCount(1);
        }).not.toThrow();

        expect(() => {
          service.validateRouteCallCount(5);
        }).not.toThrow();
      });

      it('should throw ValidationError for zero call count', () => {
        expect(() => {
          service.validateRouteCallCount(0);
        }).toThrow(ValidationError);

        try {
          service.validateRouteCallCount(0);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Invalid route call - No calls found',
          );
        }
      });
    });

    describe('validateAdapterType', () => {
      it('should pass for adapterCall type', () => {
        expect(() => {
          service.validateAdapterType('adapterCall');
        }).not.toThrow();
      });

      it('should throw ValidationError for non-adapterCall type', () => {
        expect(() => {
          service.validateAdapterType('singleCall');
        }).toThrow(ValidationError);

        try {
          service.validateAdapterType('singleCall');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Call is not an adapter call');
          expect((error as ValidationError).message).toContain('Got type: singleCall');
        }
      });

      it('should throw ValidationError for multiCall type', () => {
        expect(() => {
          service.validateAdapterType('multiCall');
        }).toThrow(ValidationError);
      });
    });

    describe('validateChainIdConsistency', () => {
      it('should pass when order target matches intent destination', () => {
        expect(() => {
          service.validateChainIdConsistency(10n, 10n);
        }).not.toThrow();
      });

      it('should throw ValidationError when chains do not match', () => {
        expect(() => {
          service.validateChainIdConsistency(10n, 1n);
        }).toThrow(ValidationError);

        try {
          service.validateChainIdConsistency(10n, 1n);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Intent destination (1) does not match order target chainID (10)',
          );
        }
      });
    });

    describe('validateNativeToken', () => {
      it('should pass for non-native token intent', () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            nativeAmount: 0n,
          },
          reward: {
            ...createMockIntent().reward,
            nativeAmount: 0n,
          },
        });

        expect(() => {
          service.validateNativeToken(intent);
        }).not.toThrow();
      });

      it('should throw ValidationError when native token in route is not supported', () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            nativeAmount: 1000n,
          },
        });

        expect(() => {
          service.validateNativeToken(intent);
        }).toThrow(ValidationError);

        try {
          service.validateNativeToken(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Native token intents are not supported',
          );
        }
      });

      it('should throw ValidationError when native token in reward is not supported', () => {
        const intent = createMockIntent({
          reward: {
            ...createMockIntent().reward,
            nativeAmount: 1000n,
          },
        });

        expect(() => {
          service.validateNativeToken(intent);
        }).toThrow(ValidationError);
      });
    });

    describe('validateSingleCall', () => {
      it('should pass for single call', () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            calls: [
              {
                target:
                  '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
                value: 0n,
                data: '0x',
              },
            ],
          },
        });

        expect(() => {
          service.validateSingleCall(intent);
        }).not.toThrow();
      });

      it('should throw ValidationError for multiple calls', () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            calls: [
              {
                target:
                  '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
                value: 0n,
                data: '0x',
              },
              {
                target:
                  '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
                value: 0n,
                data: '0x',
              },
            ],
          },
        });

        expect(() => {
          service.validateSingleCall(intent);
        }).toThrow(ValidationError);

        try {
          service.validateSingleCall(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain(
            'Only single-call routes are supported',
          );
          expect((error as ValidationError).message).toContain('Found 2 calls');
        }
      });

      it('should throw ValidationError for zero calls', () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            calls: [],
          },
        });

        expect(() => {
          service.validateSingleCall(intent);
        }).toThrow(ValidationError);
      });
    });
  });

  describe('Fee Calculation', () => {
    describe('calculateAndValidateFees', () => {
      it('should return empty fees during quoting', async () => {
        const intent = createMockIntent();

        const result = await service.calculateAndValidateFees(intent, { skipCalculation: true });

        expect(result).toEqual({
          reward: { nativeAmount: 0n, tokens: [] },
          route: { nativeAmount: 0n, tokens: [], maximum: { nativeAmount: 0n, tokens: [] } },
          fee: { base: 0n, percentage: 0n, total: 0n, bps: 0 },
        });
      });

      it('should calculate fees correctly for profitable route', async () => {
        // Use realistic token amounts in smallest units (like wei for ETH)
        // 100 USDC (6 decimals) = 100_000_000
        // We're using normalized 18 decimal values in the test
        const rewardAmount = 100_000_000_000_000_000_000n; // 100 tokens with 18 decimals
        const routeAmount = 50_000_000_000_000_000_000n; // 50 tokens with 18 decimals

        const intent = createMockIntent({
          reward: {
            ...createMockIntent().reward,
            tokens: [
              {
                token:
                  '0x00000000000000000000000000000002f050fe938943acc45f65568000000000' as UniversalAddress,
                amount: rewardAmount,
              },
            ],
          },
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token:
                  '0x00000000000000000000000000000002f050fe938943acc45f65568000000000' as UniversalAddress,
                amount: routeAmount,
              },
            ],
          },
        });

        const result = await service.calculateAndValidateFees(intent);

        // Fee calculation:
        // Base fee: 0.5 USD = 500000000000000000 (0.5 with 18 decimals)
        // Percentage fee: 100_000_000_000_000_000_000 * 30 / 10000 / 10000 = 300_000_000_000_000
        // Total fee: 500000000000000000 + 300_000_000_000_000 = ~500300000000000000
        // Maximum route: 100_000_000_000_000_000_000 - 500300000000000000 = ~99_499_700_000_000_000_000
        // Route (50_000_000_000_000_000_000) < maximum, so it's profitable

        expect(result.fee.bps).toBe(30);
        expect(result.fee.percentage).toBeGreaterThan(0n);
        expect(result.fee.total).toBeGreaterThan(0n);
        expect(result.fee.base).toBeGreaterThan(0n);

        // Verify the route is under the maximum
        expect(result.route.maximum.tokens[0].amount).toBeGreaterThan(routeAmount);

        expect(feeResolverService.resolveFee).toHaveBeenCalledWith(
          intent.destination,
          intent.route.tokens[0].token,
        );
        expect(tokenConfigService.normalize).toHaveBeenCalledWith(
          intent.sourceChainId,
          intent.reward.tokens,
        );
        expect(tokenConfigService.normalize).toHaveBeenCalledWith(
          intent.destination,
          intent.route.tokens,
        );
      });

      it('should throw ValidationError for unprofitable route', async () => {
        // Route amount > reward - fees, making it unprofitable
        const rewardAmount = 1_000_000_000_000_000_000n; // 1 token (18 decimals)
        const routeAmount = 100_000_000_000_000_000_000n; // 100 tokens (18 decimals) - way more than reward

        const intent = createMockIntent({
          reward: {
            ...createMockIntent().reward,
            tokens: [
              {
                token:
                  '0x00000000000000000000000000000002f050fe938943acc45f65568000000000' as UniversalAddress,
                amount: rewardAmount,
              },
            ],
          },
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token:
                  '0x00000000000000000000000000000002f050fe938943acc45f65568000000000' as UniversalAddress,
                amount: routeAmount,
              },
            ],
          },
        });

        await expect(service.calculateAndValidateFees(intent)).rejects.toThrow(ValidationError);

        try {
          await service.calculateAndValidateFees(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Route is not profitable');
        }
      });

      it('should throw ValidationError for missing route tokens', async () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [],
          },
        });

        await expect(service.calculateAndValidateFees(intent)).rejects.toThrow(ValidationError);

        try {
          await service.calculateAndValidateFees(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('No route tokens found');
        }
      });

      it('should throw ValidationError for missing reward tokens', async () => {
        const intent = createMockIntent({
          reward: {
            ...createMockIntent().reward,
            tokens: [],
          },
        });

        await expect(service.calculateAndValidateFees(intent)).rejects.toThrow(ValidationError);

        try {
          await service.calculateAndValidateFees(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('No reward tokens found');
        }
      });

      it('should throw ValidationError for non-zero native amounts', async () => {
        const intent = createMockIntent({
          route: {
            ...createMockIntent().route,
            nativeAmount: 1000n,
          },
        });

        await expect(service.calculateAndValidateFees(intent)).rejects.toThrow(ValidationError);

        try {
          await service.calculateAndValidateFees(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.PERMANENT);
          expect((error as ValidationError).message).toContain('Native token amounts must be zero');
        }
      });

      it('should wrap token config errors as TEMPORARY ValidationErrors', async () => {
        const intent = createMockIntent();
        tokenConfigService.normalize.mockImplementation(() => {
          throw new Error('Token not found in configuration');
        });

        await expect(service.calculateAndValidateFees(intent)).rejects.toThrow(ValidationError);

        try {
          await service.calculateAndValidateFees(intent);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).type).toBe(ValidationErrorType.TEMPORARY);
          expect((error as ValidationError).message).toContain('Failed to calculate fees');
          expect((error as ValidationError).message).toContain('Token not found');
        }
      });
    });
  });
});
