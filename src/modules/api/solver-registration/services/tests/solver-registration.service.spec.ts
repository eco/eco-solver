import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { EcoError } from '@/errors/eco-error';
import { SolverRegistrationService } from '@/modules/api/solver-registration/services/solver-registration.service';
import { EvmWalletManager } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { QuotesConfigService } from '@/modules/config/services/quotes-config.service';
import { SystemLoggerService } from '@/modules/logging';
import { SignatureGenerator } from '@/request-signing/signature-generator';

describe('RegistrationService', () => {
  let service: SolverRegistrationService;
  let blockchainConfigService: BlockchainConfigService;
  let mockWallet: IEvmWallet;
  let module: TestingModule;
  let mockApiRequestExecutor: any;

  const mockConfig: {
    registrationEnabled: boolean;
    registrationBaseUrl?: string;
    apiUrl?: string;
    registrationPrivateKey?: string;
  } = {
    registrationEnabled: true,
    registrationBaseUrl: 'https://api.example.com',
    apiUrl: 'https://api.example.com/api/v1/quotes',
    registrationPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  const mockSupportedChains = [1, 10, 137];

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      signMessage: jest.fn().mockResolvedValue('0xsignature123'),
      writeContract: jest.fn(),
      writeContracts: jest.fn(),
    } as any;

    // Mock APIRequestExecutor
    mockApiRequestExecutor = {
      executeRequest: jest.fn().mockResolvedValue({
        response: { data: { quotesUrl: 'test', solverID: 'solver-123' } },
        error: null,
      }),
      setApiConfig: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        SolverRegistrationService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: QuotesConfigService,
          useValue: {
            get registrationEnabled() {
              return mockConfig.registrationEnabled;
            },
            get registrationBaseUrl() {
              return mockConfig.registrationBaseUrl;
            },
            get apiUrl() {
              return mockConfig.apiUrl;
            },
            get registrationPrivateKey() {
              return mockConfig.registrationPrivateKey;
            },
            get config() {
              return mockConfig;
            },
          },
        },
        {
          provide: BlockchainConfigService,
          useValue: {
            getAllConfiguredChains: jest.fn().mockReturnValue(mockSupportedChains),
            getSupportedTokens: jest.fn().mockReturnValue([
              { address: '0x1234567890123456789012345678901234567890', decimals: 18 },
              { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', decimals: 6 },
            ]),
          },
        },
        {
          provide: EvmWalletManager,
          useValue: {
            getWallet: jest.fn().mockReturnValue(mockWallet),
          },
        },
        {
          provide: SystemLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: SignatureGenerator,
          useValue: {
            signPayload: jest.fn().mockResolvedValue({
              signature: '0xmocksignature',
              address: '0x1234567890123456789012345678901234567890',
              expire: Date.now() + 300000, // 5 minutes from now
            }),
            generateHeaders: jest.fn().mockReturnValue({
              'x-beam-sig': '0xmocksignature',
              'x-beam-sig-address': '0x1234567890123456789012345678901234567890',
              'x-beam-sig-expire': Date.now() + 300000,
            }),
            getHeadersWithWalletClient: jest.fn().mockResolvedValue({
              'x-beam-sig': '0xmocksignature',
              'x-beam-sig-address': '0x1234567890123456789012345678901234567890',
              'x-beam-sig-expire': Date.now() + 300000,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SolverRegistrationService>(SolverRegistrationService);
    blockchainConfigService = module.get<BlockchainConfigService>(BlockchainConfigService);

    // Initialize the service (this creates the real APIRequestExecutor)
    service.onModuleInit();

    // Now replace it with our mock
    (service as any).apiRequestExecutor = mockApiRequestExecutor;
  });

  beforeEach(() => {
    // Reset mockConfig to default values before each test
    mockConfig.registrationEnabled = true;
    mockConfig.registrationBaseUrl = 'https://api.example.com';
    mockConfig.apiUrl = 'https://api.example.com/api/v1/solverRegistry/registerSolver';
    mockConfig.registrationPrivateKey =
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register when enabled', async () => {
      // Ensure all required config is set
      mockConfig.registrationEnabled = true;
      mockConfig.registrationBaseUrl = 'https://api.example.com';
      mockConfig.apiUrl = 'https://api.example.com/api/v1/solverRegistry/registerSolver';
      mockConfig.registrationPrivateKey =
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      mockApiRequestExecutor.executeRequest.mockResolvedValue({
        response: { data: { quotesUrl: 'test', solverID: 'solver-123' } },
        error: null,
      });

      const result = await service.registerSolver();

      // Debug: log the result to see what happened
      console.log('Test result:', result);
      console.log('Mock calls:', mockApiRequestExecutor.executeRequest.mock.calls.length);

      // Verify no error occurred
      expect(result.error).toBeUndefined();

      expect(mockApiRequestExecutor.executeRequest).toHaveBeenCalledWith({
        method: 'post',
        endPoint: '/api/v1/solverRegistry/registerSolver',
        body: expect.objectContaining({
          intentExecutionTypes: ['SELF_PUBLISH', 'GASLESS'],
          quotesUrl: expect.any(String),
          quotesV2Url: expect.any(String),
          receiveSignedIntentUrl: expect.any(String),
          gaslessIntentTransactionDataUrl: expect.any(String),
          supportsNativeTransfers: false,
          crossChainRoutes: expect.objectContaining({
            crossChainRoutesConfig: expect.any(Object),
          }),
        }),
        additionalHeaders: expect.objectContaining({
          'x-beam-sig': expect.any(String),
          'x-beam-sig-address': expect.any(String),
          'x-beam-sig-expire': expect.any(String),
        }),
      });

      // Verify the request body structure
      const call = mockApiRequestExecutor.executeRequest.mock.calls[0][0];
      const requestBody = call.body;

      // Verify cross-chain routes structure
      expect(requestBody.crossChainRoutes).toBeDefined();
      expect(requestBody.crossChainRoutes.crossChainRoutesConfig).toBeDefined();

      // Should have routes for each source chain
      const routeConfig = requestBody.crossChainRoutes.crossChainRoutesConfig;
      expect(Object.keys(routeConfig)).toEqual(['1', '10', '137']);
    });

    it('should not register when disabled', async () => {
      mockConfig.registrationEnabled = false;

      const { error } = await service.registerSolver();
      expect(error).toEqual(EcoError.SolverRegistrationDisabled);

      expect(mockApiRequestExecutor.executeRequest).not.toHaveBeenCalled();
    });

    it('should error when base URL is not configured', async () => {
      mockConfig.registrationBaseUrl = undefined;

      const { error } = await service.registerSolver();

      expect(error).toEqual(EcoError.SolverRegistrationError);
      expect(mockApiRequestExecutor.executeRequest).not.toHaveBeenCalled();
    });

    it('should not throw error when apiUrl is configured', async () => {
      // Ensure both registrationBaseUrl and apiUrl are properly configured
      mockConfig.registrationBaseUrl = 'https://api.example.com';
      mockConfig.apiUrl = 'https://api.example.com/api/v1/solverRegistry/registerSolver';

      mockApiRequestExecutor.executeRequest.mockResolvedValue({
        response: { data: { quotesUrl: 'test' } },
        error: null,
      });

      await service.registerSolver();

      expect(mockApiRequestExecutor.executeRequest).toHaveBeenCalled();
    });

    it('should handle registration failure response', async () => {
      const expectedError = { message: 'Registration failed' };
      mockApiRequestExecutor.executeRequest.mockResolvedValue({
        response: null,
        error: expectedError,
      });

      const { error } = await service.registerSolver();
      expect(error).toEqual(expectedError);
    });

    it('should handle HTTP error with response', async () => {
      mockApiRequestExecutor.executeRequest.mockRejectedValue(
        new Error('Request failed with status 401: Unauthorized'),
      );

      const { error } = await service.registerSolver();
      expect(error).toEqual(EcoError.SolverRegistrationError);
    });

    it('should handle HTTP error without response', async () => {
      mockApiRequestExecutor.executeRequest.mockRejectedValue(
        new Error('Request failed - no response received'),
      );

      const { error } = await service.registerSolver();
      expect(error).toEqual(EcoError.SolverRegistrationError);
    });

    it('should create cross-chain routes for multiple chains', async () => {
      // Ensure proper configuration
      mockConfig.registrationBaseUrl = 'https://api.example.com';
      mockConfig.apiUrl = 'https://api.example.com/api/v1/solverRegistry/registerSolver';

      mockApiRequestExecutor.executeRequest.mockResolvedValue({
        response: { data: { quotesUrl: 'test', solverID: 'solver-123' } },
        error: null,
      });

      await service.registerSolver();

      expect(mockApiRequestExecutor.executeRequest).toHaveBeenCalled();
      const call = mockApiRequestExecutor.executeRequest.mock.calls[0][0];
      const requestBody = call.body;
      const routeConfig = requestBody.crossChainRoutes.crossChainRoutesConfig;

      // Verify each source chain has routes to all other chains (excluding itself)
      expect(routeConfig['1']).toBeDefined();
      expect(routeConfig['1']['1']).toBeUndefined(); // No same-chain route
      expect(routeConfig['1']['10']).toBeDefined();
      expect(routeConfig['1']['137']).toBeDefined();

      expect(routeConfig['10']).toBeDefined();
      expect(routeConfig['10']['10']).toBeUndefined(); // No same-chain route
      expect(routeConfig['10']['1']).toBeDefined();
      expect(routeConfig['10']['137']).toBeDefined();

      expect(routeConfig['137']).toBeDefined();
      expect(routeConfig['137']['137']).toBeUndefined(); // No same-chain route
      expect(routeConfig['137']['1']).toBeDefined();
      expect(routeConfig['137']['10']).toBeDefined();

      // Verify route structure: each route maps source tokens to destination tokens
      const route1to10 = routeConfig['1']['10'];
      expect(Array.isArray(route1to10)).toBe(true);
      expect(route1to10.length).toBe(2); // 2 tokens configured in mock

      route1to10.forEach((mapping: any) => {
        expect(mapping).toHaveProperty('send');
        expect(mapping).toHaveProperty('receive');
        expect(Array.isArray(mapping.receive)).toBe(true);
        expect(mapping.receive.length).toBe(2); // 2 tokens on destination
      });
    });

    it('should handle single chain configuration', async () => {
      // Ensure proper configuration
      mockConfig.registrationBaseUrl = 'https://api.example.com';
      mockConfig.apiUrl = 'https://api.example.com/api/v1/solverRegistry/registerSolver';

      (blockchainConfigService.getAllConfiguredChains as jest.Mock).mockReturnValue([1]);

      mockApiRequestExecutor.executeRequest.mockResolvedValue({
        response: { data: { quotesUrl: 'test', solverID: 'solver-123' } },
        error: null,
      });

      await service.registerSolver();

      expect(mockApiRequestExecutor.executeRequest).toHaveBeenCalled();
      const call = mockApiRequestExecutor.executeRequest.mock.calls[0][0];
      const requestBody = call.body;
      const routeConfig = requestBody.crossChainRoutes.crossChainRoutesConfig;

      // Should have entry for the single chain but with no destinations
      expect(routeConfig['1']).toBeDefined();
      expect(Object.keys(routeConfig['1']).length).toBe(0);
    });

    it('should skip same-chain routes', async () => {
      // Ensure proper configuration
      mockConfig.registrationBaseUrl = 'https://api.example.com';
      mockConfig.apiUrl = 'https://api.example.com/api/v1/solverRegistry/registerSolver';

      mockApiRequestExecutor.executeRequest.mockResolvedValue({
        response: { data: { quotesUrl: 'test', solverID: 'solver-123' } },
        error: null,
      });

      await service.registerSolver();

      expect(mockApiRequestExecutor.executeRequest).toHaveBeenCalled();
      const call = mockApiRequestExecutor.executeRequest.mock.calls[0][0];
      const requestBody = call.body;
      const routeConfig = requestBody.crossChainRoutes.crossChainRoutesConfig;

      // Verify no source chain has itself as a destination
      Object.keys(routeConfig).forEach((sourceChain) => {
        expect(routeConfig[sourceChain][sourceChain]).toBeUndefined();
      });
    });
  });
});
