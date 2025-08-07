import { Test } from '@nestjs/testing';

import { IMessageBridgeProverAbi } from '@eco-foundation/routes-ts';
import { Address, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

import { EvmReaderService } from '../evm.reader.service';
import { EvmTransportService } from '../evm-transport.service';

describe('EvmReaderService', () => {
  let service: EvmReaderService;
  let transportService: jest.Mocked<EvmTransportService>;
  let evmConfigService: jest.Mocked<EvmConfigService>;
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
      ],
    }).compile();

    service = module.get<EvmReaderService>(EvmReaderService);
    transportService = module.get(EvmTransportService);
    evmConfigService = module.get(EvmConfigService);
  });

  describe('fetchProverFee', () => {
    const mockIntent: Intent = {
      intentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      reward: {
        prover: '0x1234567890123456789012345678901234567890' as Address,
        creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
        deadline: BigInt(Date.now() + 86400000), // 24 hours from now
        nativeValue: BigInt(1000000000000000000), // 1 ETH
        tokens: [],
      },
      route: {
        source: BigInt(1),
        destination: BigInt(10),
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
        inbox: '0x9876543210987654321098765432109876543210' as Address,
        calls: [],
        tokens: [],
      },
      status: IntentStatus.PENDING,
    };

    const mockClaimant = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address;
    const chainId = 1;

    it('should fetch prover fee successfully', async () => {
      const expectedFee = BigInt(500000000000000000); // 0.5 ETH
      const messageData = '0xdeadbeef' as Hex;
      mockPublicClient.readContract.mockResolvedValue(expectedFee);

      const result = await service.fetchProverFee(mockIntent, messageData, chainId, mockClaimant);

      expect(result).toBe(expectedFee);
      expect(transportService.getPublicClient).toHaveBeenCalledWith(chainId);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockIntent.reward.prover,
        abi: IMessageBridgeProverAbi,
        functionName: 'fetchFee',
        args: [mockIntent.route.source, [mockIntent.intentHash], [mockClaimant], messageData],
      });
    });

    it('should fetch prover fee without claimant', async () => {
      const expectedFee = BigInt(300000000000000000); // 0.3 ETH
      mockPublicClient.readContract.mockResolvedValue(expectedFee);

      const messageData = '0xdeadbeef' as Hex;
      const result = await service.fetchProverFee(mockIntent, messageData, chainId);

      expect(result).toBe(expectedFee);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockIntent.reward.prover,
        abi: IMessageBridgeProverAbi,
        functionName: 'fetchFee',
        args: [mockIntent.route.source, [mockIntent.intentHash], [undefined], messageData],
      });
    });

    it('should handle missing transport client', async () => {
      transportService.getPublicClient.mockImplementation(() => {
        throw new Error('No transport client available');
      });

      await expect(
        service.fetchProverFee(mockIntent, '0xdeadbeef' as Hex, chainId, mockClaimant),
      ).rejects.toThrow('No transport client available');
    });

    it('should handle contract read errors', async () => {
      const contractError = new Error('Contract execution reverted');
      mockPublicClient.readContract.mockRejectedValue(contractError);

      await expect(
        service.fetchProverFee(mockIntent, '0xdeadbeef' as Hex, chainId, mockClaimant),
      ).rejects.toThrow('Failed to fetch prover fee: Contract execution reverted');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockPublicClient.readContract.mockRejectedValue(networkError);

      await expect(
        service.fetchProverFee(mockIntent, '0xdeadbeef' as Hex, chainId, mockClaimant),
      ).rejects.toThrow('Failed to fetch prover fee: Network timeout');
    });

    it('should work with different intent configurations', async () => {
      const customIntent: Intent = {
        ...mockIntent,
        reward: {
          ...mockIntent.reward,
          prover: '0xffffffffffffffffffffffffffffffffffffffff' as Address,
        },
        route: {
          ...mockIntent.route,
          source: BigInt(137), // Polygon chain ID
        },
      };
      const expectedFee = BigInt(100000000000000); // 0.0001 ETH
      mockPublicClient.readContract.mockResolvedValue(expectedFee);

      const result = await service.fetchProverFee(customIntent, '0x' as Hex, chainId, mockClaimant);

      expect(result).toBe(expectedFee);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: customIntent.reward.prover,
        abi: IMessageBridgeProverAbi,
        functionName: 'fetchFee',
        args: [customIntent.route.source, [customIntent.intentHash], [mockClaimant], '0x' as Hex],
      });
    });
  });
});
