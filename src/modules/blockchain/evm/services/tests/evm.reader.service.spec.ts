import { Test } from '@nestjs/testing';

import { Hex } from 'viem';
import * as viem from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmReaderService } from '../evm.reader.service';
import { EvmTransportService } from '../evm-transport.service';

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    encodePacked: jest.fn(),
    pad: jest.fn().mockImplementation((value) => value),
  };
});

describe('EvmReaderService', () => {
  let service: EvmReaderService;
  let transportService: jest.Mocked<EvmTransportService>;
  let mockPublicClient: any;

  beforeEach(async () => {
    // Create a mock public client
    mockPublicClient = {
      readContract: jest.fn(),
      getBalance: jest.fn(),
    };

    // Create mock services
    const mockTransportService = {
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
    };

    const mockEvmConfigService = {
      getChain: jest.fn(),
      getIntentSourceAddress: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockOtelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            addEvent: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        EvmReaderService,
        {
          provide: EvmTransportService,
          useValue: mockTransportService,
        },
        {
          provide: EvmConfigService,
          useValue: mockEvmConfigService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    service = module.get<EvmReaderService>(EvmReaderService);
    transportService = module.get(EvmTransportService);
  });

  describe('fetchProverFee', () => {
    const mockIntent: Intent = {
      intentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      sourceChainId: BigInt(1),
      destination: BigInt(10),
      reward: {
        prover: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
        creator: '0x00000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd' as any,
        deadline: BigInt(Date.now() + 86400000), // 24 hours from now
        nativeAmount: BigInt(1000000000000000000), // 1 ETH
        tokens: [],
      },
      route: {
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
        portal: '0x0000000000000000000000009876543210987654321098765432109876543210' as any,
        deadline: BigInt(Date.now() + 86400000),
        nativeAmount: BigInt(0),
        calls: [],
        tokens: [],
      },
      status: IntentStatus.PENDING,
    };

    const mockClaimant = '0x00000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as any;
    const prover = mockIntent.reward.prover;
    const chainId = 1;

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      (viem.encodePacked as jest.Mock).mockReturnValue('0xencodedProof');
    });

    it('should fetch prover fee successfully', async () => {
      const expectedFee = BigInt(500000000000000000); // 0.5 ETH
      const messageData = '0xdeadbeef' as Hex;
      mockPublicClient.readContract.mockResolvedValue(expectedFee);

      const result = await service.fetchProverFee(
        mockIntent,
        prover,
        messageData,
        chainId,
        mockClaimant,
      );

      expect(result).toBe(expectedFee);
      expect(transportService.getPublicClient).toHaveBeenCalledWith(chainId);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0x1234567890123456789012345678901234567890',
        abi: messageBridgeProverAbi,
        functionName: 'fetchFee',
        args: expect.arrayContaining([
          mockIntent.sourceChainId,
          expect.anything(), // encodeProof result
          messageData,
        ]),
      });
    });

    it('should fetch prover fee without claimant', async () => {
      const expectedFee = BigInt(300000000000000000); // 0.3 ETH
      mockPublicClient.readContract.mockResolvedValue(expectedFee);

      const messageData = '0xdeadbeef' as Hex;
      const result = await service.fetchProverFee(
        mockIntent,
        prover,
        messageData,
        chainId,
        mockClaimant,
      );

      expect(result).toBe(expectedFee);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0x1234567890123456789012345678901234567890',
        abi: messageBridgeProverAbi,
        functionName: 'fetchFee',
        args: expect.arrayContaining([
          mockIntent.sourceChainId,
          expect.anything(), // encodeProof result
          messageData,
        ]),
      });
    });

    it('should handle missing transport client', async () => {
      transportService.getPublicClient.mockImplementation(() => {
        throw new Error('No transport client available');
      });

      await expect(
        service.fetchProverFee(mockIntent, prover, '0xdeadbeef' as Hex, chainId, mockClaimant),
      ).rejects.toThrow('No transport client available');
    });

    it('should handle contract read errors', async () => {
      const contractError = new Error('Contract execution reverted');
      mockPublicClient.readContract.mockRejectedValue(contractError);

      await expect(
        service.fetchProverFee(mockIntent, prover, '0xdeadbeef' as Hex, chainId, mockClaimant),
      ).rejects.toThrow('Failed to fetch prover fee: Contract execution reverted');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockPublicClient.readContract.mockRejectedValue(networkError);

      await expect(
        service.fetchProverFee(mockIntent, prover, '0xdeadbeef' as Hex, chainId, mockClaimant),
      ).rejects.toThrow('Failed to fetch prover fee: Network timeout');
    });

    it('should work with different intent configurations', async () => {
      const customIntent: Intent = {
        ...mockIntent,
        sourceChainId: BigInt(137), // Polygon chain ID
        reward: {
          ...mockIntent.reward,
          prover: '0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff' as any,
        },
        route: {
          ...mockIntent.route,
        },
      };
      const expectedFee = BigInt(100000000000000); // 0.0001 ETH
      mockPublicClient.readContract.mockResolvedValue(expectedFee);

      const result = await service.fetchProverFee(
        customIntent,
        customIntent.reward.prover,
        '0x' as Hex,
        chainId,
        mockClaimant,
      );

      expect(result).toBe(expectedFee);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF',
        abi: messageBridgeProverAbi,
        functionName: 'fetchFee',
        args: expect.arrayContaining([
          customIntent.sourceChainId,
          expect.anything(), // encodeProof result
          '0x' as Hex,
        ]),
      });
    });
  });
});
