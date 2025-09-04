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
  let mockWallet: IEvmWallet;

  let mockConfig: {
    registrationEnabled: boolean;
    registrationBaseUrl?: string;
    solverEndpoint?: string;
  } = {
    registrationEnabled: true,
    registrationBaseUrl: 'https://api.example.com',
    solverEndpoint: 'https://solver.example.com',
  };

  const mockSupportedChains = [1, 10, 137];

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      signMessage: jest.fn().mockResolvedValue('0xsignature123'),
      writeContract: jest.fn(),
      writeContracts: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
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
            get solverEndpoint() {
              return mockConfig.solverEndpoint;
            },
            registration: mockConfig,
            config: { registration: mockConfig },
          },
        },
        {
          provide: BlockchainConfigService,
          useValue: {
            getAllConfiguredChains: jest.fn().mockReturnValue(mockSupportedChains),
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
  });

  beforeEach(() => {
    // Reset mockConfig to default values before each test
    mockConfig = {
      registrationEnabled: true,
      registrationBaseUrl: 'https://api.example.com',
      solverEndpoint: 'https://solver.example.com',
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
          solverEndpoint: 'https://solver.example.com',
          supportedChains: [1, 10, 137],
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-signature': '0xsignature123',
            'x-timestamp': expect.any(String),
            'x-signer': '0x1234567890123456789012345678901234567890',
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
      expect(logger.error).toHaveBeenCalledWith('Registration base URL is not configured');
    });

    it('should throw error when solver endpoint is not configured', async () => {
      mockConfig.solverEndpoint = undefined;

      await service.register();

      expect(httpService.post).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Solver endpoint URL is not configured'),
      );
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

    it('should handle cases when no EVM chains are configured', async () => {
      (evmWalletManager.getWallet as jest.Mock).mockImplementation(() => {
        throw new Error('No wallet available');
      });

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
        expect.any(Object),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'x-signature': expect.any(String),
            'x-signer': expect.any(String),
          }),
        }),
      );
    });
  });
});
