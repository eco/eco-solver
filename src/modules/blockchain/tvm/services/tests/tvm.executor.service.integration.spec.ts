import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { Address, encodeFunctionData, erc20Abi, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { TvmConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { TvmListenersManagerService } from '../../listeners/tvm-listeners-manager.service';
import { BasicWalletFactory } from '../../wallets/basic-wallet';
import { TvmExecutorService } from '../tvm.executor.service';
import { TvmReaderService } from '../tvm.reader.service';
import { TvmTransportService } from '../tvm-transport.service';
import { TvmWalletManagerService } from '../tvm-wallet-manager.service';

describe('TvmExecutorService Integration - Mainnet Happy Path', () => {
  let module: TestingModule;
  let executorService: TvmExecutorService;
  let transportService: TvmTransportService;

  // Mock configuration
  const mockTvmConfig = {
    isConfigured: jest.fn().mockReturnValue(true),
    networks: [
      {
        chainId: 'tron-mainnet',
        rpc: {
          fullNode: 'https://api.trongrid.io',
          solidityNode: 'https://api.trongrid.io',
          eventServer: 'https://api.trongrid.io',
          options: {},
        },
        intentSourceAddress: 'TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG',
        inboxAddress: 'TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN',
        fee: {
          tokens: {
            flatFee: '100000',
            scalarBps: 10,
          },
          native: {
            flatFee: '500000',
            scalarBps: 50,
          },
        },
        tokens: [
          {
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            decimals: 6,
            limit: 100,
          },
        ],
        provers: {
          hyper: 'TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG',
          metalayer: 'TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN',
        },
      },
    ],
    supportedChainIds: ['tron-mainnet'],
    getChain: jest.fn().mockImplementation((chainId) => {
      // Handle both 'tron-mainnet' string and numeric chain ID 728126428 (0x2b6653dc)
      const normalizedChainId = chainId === 728126428 ? 'tron-mainnet' : chainId;
      const network = mockTvmConfig.networks.find((n) => n.chainId === normalizedChainId);
      if (!network) throw new Error(`Network not found: ${chainId}`);
      return network;
    }),
    getRpc: jest.fn().mockImplementation((chainId) => {
      return mockTvmConfig.getChain(chainId).rpc;
    }),
    getBasicWalletConfig: jest.fn().mockReturnValue({
      // Use a test private key that will generate a valid Tron address
      // This is a well-known test private key - DO NOT USE IN PRODUCTION
      privateKey: '0',
    }),
    getIntentSourceAddress: jest.fn().mockImplementation((chainId) => {
      // Handle numeric Tron chain ID
      if (chainId === 728126428 || chainId === 'tron-mainnet') {
        return 'TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG';
      }
      throw new Error(`Network not found: ${chainId}`);
    }),
    getInboxAddress: jest.fn().mockImplementation((chainId) => {
      // Handle numeric Tron chain ID
      if (chainId === 728126428 || chainId === 'tron-mainnet') {
        return 'TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN';
      }
      throw new Error(`Network not found: ${chainId}`);
    }),
    getSupportedTokens: jest.fn().mockReturnValue([
      {
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        decimals: 6,
        limit: 100,
      },
    ]),
    getTokenConfig: jest.fn().mockReturnValue({
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      decimals: 6,
      limit: 100,
    }),
    getFeeLogic: jest.fn().mockReturnValue({
      tokens: {
        flatFee: '100000',
        scalarBps: 10,
      },
      native: {
        flatFee: '500000',
        scalarBps: 50,
      },
    }),
  };

  // Mock ProverService - handle both numeric and string chain IDs
  const mockProverService = {
    getProver: jest.fn().mockImplementation((chainId, proverAddress) => {
      console.log('ProverService.getProver called with:', { chainId, proverAddress });
      return {
        getContractAddress: jest.fn().mockReturnValue('TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG'),
        getFee: jest.fn().mockResolvedValue(BigInt(1000000)),
        getMessageData: jest.fn().mockResolvedValue('0x1234567890abcdef'),
      };
    }),
  };

  // Mock FulfillmentService
  const mockFulfillmentService = {
    submitIntent: jest.fn(),
  };

  // Mock Logger
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  // Mock OpenTelemetry
  const mockOtelService = {
    startSpan: jest.fn().mockReturnValue({
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    }),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        // TVM module services
        TvmTransportService,
        TvmReaderService,
        TvmExecutorService,
        TvmWalletManagerService,
        TvmListenersManagerService,
        BasicWalletFactory,
        // Mock external dependencies
        {
          provide: TvmConfigService,
          useValue: mockTvmConfig,
        },
        {
          provide: ProverService,
          useValue: mockProverService,
        },
        {
          provide: FulfillmentService,
          useValue: mockFulfillmentService,
        },
        {
          provide: SystemLoggerService,
          useValue: mockLogger,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    executorService = module.get<TvmExecutorService>(TvmExecutorService);
    transportService = module.get<TvmTransportService>(TvmTransportService);

    jest.spyOn(executorService as any, 'waitForTransaction').mockResolvedValue(true);
    jest.spyOn(executorService as any, 'waitForTransactions').mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should successfully fulfill an intent on Tron mainnet', async () => {
    // Convert Tron addresses to hex format
    const proverAddress = transportService.toEvmHex('TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG');
    const creatorAddress = transportService.toEvmHex('TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN');
    const inboxAddress = transportService.toEvmHex('TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN');
    const usdtAddress = transportService.toEvmHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    const recipientAddress = transportService.toEvmHex('TLRwjRfjxa4wEDom56qCo1nYiAfJaozJVi');

    // Create a test intent with Tron mainnet data
    const testIntent: Intent = {
      intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      reward: {
        prover: proverAddress as Address,
        creator: creatorAddress as Address,
        deadline: BigInt(Date.now() + 86400000), // 24 hours from now
        nativeValue: BigInt(0), // 1 TRX in SUN
        tokens: [],
      },
      route: {
        source: BigInt(8453), // Base chain ID
        destination: BigInt(0x2b6653dc), // Tron chain ID (hex: 0x2b6653dc = decimal: 728126428)
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
        inbox: inboxAddress as Address,
        calls: [
          {
            target: usdtAddress as Address,
            value: 0n,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [recipientAddress, BigInt(10000)],
            }),
          },
        ],
        tokens: [
          {
            token: usdtAddress as Address, // USDT on Tron
            amount: BigInt(10000), // 0.01 USDT (6 decimals)
          },
        ],
      },
      status: IntentStatus.PENDING,
    };

    // Execute the fulfill method
    console.log('Executing fulfill with intent:', {
      source: testIntent.route.source.toString(),
      destination: testIntent.route.destination.toString(),
      prover: testIntent.reward.prover,
    });

    let result;
    try {
      result = await executorService.fulfill(testIntent, 'basic');
    } catch (error) {
      console.error('Exception during fulfill:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }

    // Assertions
    expect(result).toBeDefined();
    console.log('Fulfillment result:', JSON.stringify(result, null, 2));

    // Log any error for debugging
    if (!result.success) {
      console.error('Fulfillment failed with error:', result.error);
      // Fail the test with the actual error for visibility
      throw new Error(`Fulfillment failed: ${result.error}`);
    }

    // The test should be successful
    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
    expect(typeof result.txHash).toBe('string');
    expect(result.txHash.length).toBeGreaterThan(0);
    console.log('Transaction successful with hash:', result.txHash);

    // Verify the prover service was called with correct parameters
    expect(mockProverService.getProver).toHaveBeenCalled();
    const proverCall = mockProverService.getProver.mock.calls[0];
    console.log('Prover was called with:', proverCall);

    // The executor uses the source chain ID (Base: 8453) for the prover
    expect(proverCall[0]).toBe(8453);
    expect(proverCall[1]).toBe(testIntent.reward.prover);

    // Verify OpenTelemetry span was created
    expect(mockOtelService.startSpan).toHaveBeenCalled();
  });
});
