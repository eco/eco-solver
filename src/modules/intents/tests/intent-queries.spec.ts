import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { toUniversalAddress } from '@/common/types/universal-address.type';

import { IntentsService } from '../intents.service';
import { Intent } from '../schemas/intent.schema';

describe('Intent Queries - Index Verification', () => {
  let service: IntentsService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        IntentsService,
        {
          provide: getModelToken(Intent.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<IntentsService>(IntentsService);
  });

  describe('route.source index queries', () => {
    it('should query using route.source field', async () => {
      mockModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.findProvenNotWithdrawn(BigInt(1));

      expect(mockModel.find).toHaveBeenCalledWith({
        provenEvent: { $exists: true },
        withdrawnEvent: { $exists: false },
        'route.source': '1',
      });

      // This query should use the compound index:
      // { 'route.source': 1, provenEvent: 1, withdrawnEvent: 1 }
    });
  });

  describe('provenEvent index queries', () => {
    it('should find proven but not withdrawn intents efficiently', async () => {
      mockModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.findProvenNotWithdrawn(BigInt(1));

      expect(mockModel.find).toHaveBeenCalledWith({
        provenEvent: { $exists: true },
        withdrawnEvent: { $exists: false },
        'route.source': '1',
      });

      // This query should use the compound index:
      // { 'route.source': 1, provenEvent: 1, withdrawnEvent: 1 }
    });

    it('should find all proven not withdrawn when no chain specified', async () => {
      mockModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.findProvenNotWithdrawn();

      expect(mockModel.find).toHaveBeenCalledWith({
        provenEvent: { $exists: true },
        withdrawnEvent: { $exists: false },
      });
    });

    it('should update provenEvent with transaction data', async () => {
      const mockIntent = { intentHash: '0x123' };
      mockModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockIntent),
      });

      const claimantAddress = toUniversalAddress(
        '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      );

      await service.updateProvenEvent({
        intentHash: '0x123',
        claimant: claimantAddress,
        transactionHash: '0xdef',
        blockNumber: BigInt(12345),
        timestamp: new Date(),
        chainId: BigInt(1),
      });

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { intentHash: '0x123' },
        expect.objectContaining({
          provenEvent: expect.objectContaining({
            claimant: claimantAddress,
            transactionHash: '0xdef',
            blockNumber: '12345',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('withdrawnEvent index queries', () => {
    it('should update withdrawnEvent and use index for lookups', async () => {
      const mockIntent = { intentHash: '0x123' };
      mockModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockIntent),
      });

      const claimantAddress = toUniversalAddress(
        '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      );

      await service.updateWithdrawnEvent({
        intentHash: '0x123',
        claimant: claimantAddress,
        transactionHash: '0xdef',
        blockNumber: BigInt(12345),
        timestamp: new Date(),
        chainId: BigInt(1),
      });

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { intentHash: '0x123' },
        expect.objectContaining({
          withdrawnEvent: expect.objectContaining({
            claimant: claimantAddress,
            txHash: '0xdef',
            blockNumber: '12345',
          }),
        }),
        expect.any(Object),
      );
    });
  });
});
