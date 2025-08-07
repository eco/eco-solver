import { Test, TestingModule } from '@nestjs/testing';

import {
  Chain,
  createPublicClient,
  extractChain,
  fallback,
  http,
  Transport,
  webSocket,
} from 'viem';
import * as chains from 'viem/chains';

import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../evm-transport.service';

jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  extractChain: jest.fn(),
  fallback: jest.fn(),
  http: jest.fn(),
  webSocket: jest.fn(),
}));

describe('EvmTransportService', () => {
  let service: EvmTransportService;
  let evmConfigService: jest.Mocked<EvmConfigService>;

  const mockChain: Chain = {
    id: 1,
    name: 'Ethereum',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ['https://mainnet.infura.io/v3/'] },
    },
  } as Chain;

  const mockTransport = {} as Transport;
  const mockPublicClient = { id: 'mockPublicClient' };

  beforeEach(async () => {
    evmConfigService = {
      networks: [
        {
          chainId: 1,
          rpc: { urls: ['https://mainnet.infura.io/v3/'], options: {} },
        },
        {
          chainId: 10,
          rpc: { urls: ['https://optimism.io', 'https://optimism-backup.io'], options: {} },
        },
        {
          chainId: 137,
          rpc: { urls: ['wss://polygon-ws.io'], options: { timeout: 5000 } },
        },
      ],
      getChain: jest.fn().mockImplementation((chainId) => {
        const network = evmConfigService.networks.find((n) => n.chainId === chainId);
        if (!network) {
          throw new Error(`Chain ${chainId} not found`);
        }
        return network;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [EvmTransportService, { provide: EvmConfigService, useValue: evmConfigService }],
    }).compile();

    service = module.get<EvmTransportService>(EvmTransportService);

    // Mock viem functions
    (extractChain as jest.Mock).mockReturnValue(mockChain);
    (http as jest.Mock).mockReturnValue(mockTransport);
    (webSocket as jest.Mock).mockReturnValue(mockTransport);
    (fallback as jest.Mock).mockReturnValue(mockTransport);
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize transports for all configured chains', () => {
      service.onModuleInit();

      // Should extract chain for each configured network
      expect(extractChain).toHaveBeenCalledTimes(3);
      expect(extractChain).toHaveBeenCalledWith({
        chains: Object.values(chains),
        id: 1,
      });
      expect(extractChain).toHaveBeenCalledWith({
        chains: Object.values(chains),
        id: 10,
      });
      expect(extractChain).toHaveBeenCalledWith({
        chains: Object.values(chains),
        id: 137,
      });
    });

    it('should create http transport for single RPC URL', () => {
      service.onModuleInit();

      expect(http).toHaveBeenCalledWith('https://mainnet.infura.io/v3/', {});
    });

    it('should create fallback transport for multiple RPC URLs', () => {
      service.onModuleInit();

      expect(http).toHaveBeenCalledWith('https://optimism.io', {});
      expect(http).toHaveBeenCalledWith('https://optimism-backup.io', {});
      expect(fallback).toHaveBeenCalled();
    });

    it('should prefer WebSocket transport when available', () => {
      service.onModuleInit();

      expect(webSocket).toHaveBeenCalledWith('wss://polygon-ws.io', { timeout: 5000 });
    });
  });

  describe('getTransport', () => {
    it('should return transport for initialized chain', () => {
      service.onModuleInit();

      const transport = service.getTransport(1);

      expect(transport).toBe(mockTransport);
    });

    it('should initialize transport lazily if not already initialized', () => {
      const transport = service.getTransport(1);

      expect(transport).toBe(mockTransport);
      expect(extractChain).toHaveBeenCalled();
    });

    it('should throw error for uninitialized chain', () => {
      evmConfigService.getChain.mockImplementation(() => {
        throw new Error('Chain 999 not found');
      });

      expect(() => service.getTransport(999)).toThrow();
    });

    it('should not re-initialize already initialized transport', () => {
      service.onModuleInit();
      jest.clearAllMocks();

      const transport1 = service.getTransport(1);
      const transport2 = service.getTransport(1);

      expect(transport1).toBe(transport2);
      expect(extractChain).not.toHaveBeenCalled();
    });
  });

  describe('getViemChain', () => {
    it('should return chain for initialized chain', () => {
      service.onModuleInit();

      const chain = service.getViemChain(1);

      expect(chain).toBe(mockChain);
    });

    it('should initialize chain lazily if not already initialized', () => {
      const chain = service.getViemChain(1);

      expect(chain).toBe(mockChain);
      expect(extractChain).toHaveBeenCalled();
    });

    it('should throw error for uninitialized chain', () => {
      evmConfigService.getChain.mockImplementation(() => {
        throw new Error('Chain 999 not found');
      });

      expect(() => service.getViemChain(999)).toThrow();
    });
  });

  describe('getPublicClient', () => {
    it('should create public client with chain and transport', () => {
      const client = service.getPublicClient(1);

      expect(client).toBe(mockPublicClient);
      expect(createPublicClient).toHaveBeenCalledWith({
        chain: mockChain,
        transport: mockTransport,
      });
    });

    it('should initialize transport if not already initialized', () => {
      const client = service.getPublicClient(10);

      expect(client).toBe(mockPublicClient);
      expect(extractChain).toHaveBeenCalled();
      expect(createPublicClient).toHaveBeenCalled();
    });
  });

  describe('WebSocket transport handling', () => {
    it('should create single WebSocket transport', () => {
      Object.defineProperty(evmConfigService, 'networks', {
        get: jest.fn().mockReturnValue([
          {
            chainId: 42,
            rpc: { urls: ['wss://test-ws.io'], options: { reconnect: true } },
          },
        ]),
        configurable: true,
      });

      service.onModuleInit();

      expect(webSocket).toHaveBeenCalledWith('wss://test-ws.io', { reconnect: true });
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should create fallback WebSocket transport for multiple URLs', () => {
      Object.defineProperty(evmConfigService, 'networks', {
        get: jest.fn().mockReturnValue([
          {
            chainId: 42,
            rpc: {
              urls: ['wss://test-ws1.io', 'wss://test-ws2.io'],
              options: { reconnect: true },
            },
          },
        ]),
        configurable: true,
      });

      service.onModuleInit();

      expect(webSocket).toHaveBeenCalledWith('wss://test-ws1.io', { reconnect: true });
      expect(webSocket).toHaveBeenCalledWith('wss://test-ws2.io', { reconnect: true });
      expect(fallback).toHaveBeenCalled();
    });
  });
});
