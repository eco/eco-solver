import { Test } from '@nestjs/testing';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { Address, Hex, encodePacked, pad } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmReaderService } from '../evm.reader.service';
import { EvmTransportService } from '../evm-transport.service';

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodePacked: jest.fn(),
  pad: jest.fn().mockImplementation((value) => value),
}));

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
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockOtelService = {
      startSpan: jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        addEvent: jest.fn(),
        end: jest.fn(),
      }),
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
          provide: SystemLoggerService,
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
        prover: '0x1234567890123456789012345678901234567890' as Address,
        creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
        deadline: BigInt(Date.now() + 86400000), // 24 hours from now
        nativeAmount: BigInt(1000000000000000000), // 1 ETH
        tokens: [],
      },
      route: {
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
        portal: '0x9876543210987654321098765432109876543210' as Address,
        deadline: BigInt(Date.now() + 86400000),
        nativeAmount: BigInt(0),
        calls: [],
        tokens: [],
      },
      status: IntentStatus.PENDING,
    };

    const mockClaimant = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address;
    const prover = mockIntent.reward.prover;
    const chainId = 1;

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      (encodePacked as jest.Mock).mockReturnValue('0xencodedProof');
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
        address: mockIntent.reward.prover,
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
      const result = await service.fetchProverFee(mockIntent, prover, messageData, chainId);

      expect(result).toBe(expectedFee);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockIntent.reward.prover,
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
          prover: '0xffffffffffffffffffffffffffffffffffffffff' as Address,
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
        address: customIntent.reward.prover,
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
