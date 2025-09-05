import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';

import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { EvmWalletManager } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { QuotesConfigService } from '@/modules/config/services/quotes-config.service';
import { SystemLoggerService } from '@/modules/logging';

import { QuoteRegistrationService } from '../services/quote-registration.service';

describe('RegistrationService', () => {
  let service: QuoteRegistrationService;
  let httpService: HttpService;
  let configService: QuotesConfigService;
  let evmWalletManager: EvmWalletManager;
  let logger: SystemLoggerService;
  let blockchainConfigService: BlockchainConfigService;
  let mockWallet: IEvmWallet;
  let module: TestingModule;

  let mockConfig: {
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

    module = await Test.createTestingModule({
      providers: [
        QuoteRegistrationService,
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
      ],
    }).compile();

    service = module.get<QuoteRegistrationService>(QuoteRegistrationService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<QuotesConfigService>(QuotesConfigService);
    evmWalletManager = module.get<EvmWalletManager>(EvmWalletManager);
    logger = module.get<SystemLoggerService>(SystemLoggerService);
    blockchainConfigService = module.get<BlockchainConfigService>(BlockchainConfigService);
  });

  beforeEach(() => {
    // Reset mockConfig to default values before each test
    mockConfig = {
      registrationEnabled: true,
      registrationBaseUrl: 'https://api.example.com',
      apiUrl: 'https://api.example.com/api/v1/quotes',
      registrationPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register when enabled', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true, solverId: 'solver-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: new AxiosHeaders(),
        },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      await service.register();

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/quotes',
        expect.objectContaining({
          intentExecutionTypes: ['SELF_PUBLISH'],
          quotesUrl: 'https://api.example.com/api/v1/quotes',
          receiveSignedIntentUrl: 'https://api.example.com/api/v1/quotes',
          supportsNativeTransfers: false,
          crossChainRoutes: expect.any(Object),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-beam-sig': expect.any(String),
            'x-beam-sig-expire': expect.any(Number),
            'x-beam-sig-address': expect.any(String),
          }),
        }),
      );

      expect(logger.log).toHaveBeenCalledWith('Successfully registered with ID: solver-123');
    });

    it('should not register when disabled', async () => {
      mockConfig.registrationEnabled = false;

      await service.register();

      expect(httpService.post).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('Registration is disabled');
    });

    it('should error when base URL is not configured', async () => {
      mockConfig.registrationBaseUrl = undefined;

      await service.register();

      expect(httpService.post).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Registration failed: Registration base URL is not configured',
      );
    });

    it('should not throw error when apiUrl is configured', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: new AxiosHeaders(),
        },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      await service.register();

      expect(httpService.post).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('Successfully registered with ID: N/A');
    });

    it('should handle registration failure response', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: false, message: 'Invalid credentials' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: new AxiosHeaders(),
        },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      await service.register();

      expect(logger.error).toHaveBeenCalledWith('Registration failed: Invalid credentials');
    });

    it('should handle HTTP error with response', async () => {
      const error = new AxiosError('Request failed');
      error.response = {
        status: 401,
        data: { message: 'Unauthorized' },
        statusText: 'Unauthorized',
        headers: {},
        config: {
          headers: new AxiosHeaders(),
        },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error));

      await service.register();

      expect(logger.error).toHaveBeenCalledWith(
        'Registration failed with status 401: Unauthorized',
      );
    });

    it('should handle HTTP error without response', async () => {
      const error = new AxiosError('Request failed');
      error.request = {};

      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error));

      await service.register();

      expect(logger.error).toHaveBeenCalledWith(
        'Registration failed - no response received: Request failed',
      );
    });

    it('should handle cases when no chains are configured', async () => {
      (blockchainConfigService.getAllConfiguredChains as jest.Mock).mockReturnValue([]);

      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: new AxiosHeaders(),
        },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      await service.register();

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          crossChainRoutes: {
            crossChainRoutesConfig: {
              '*': {},
            },
          },
        }),
        expect.any(Object),
      );
    });
  });
});
