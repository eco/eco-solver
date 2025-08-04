import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';

import { FundingValidation } from '../funding.validation';
import { createMockIntent } from '../test-helpers';

describe('FundingValidation', () => {
  let validation: FundingValidation;
  let blockchainReaderService: jest.Mocked<BlockchainReaderService>;

  beforeEach(async () => {
    const mockBlockchainReaderService = {
      getBalance: jest.fn(),
      getTokenBalance: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FundingValidation,
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReaderService,
        },
      ],
    }).compile();

    validation = module.get<FundingValidation>(FundingValidation);
    blockchainReaderService = module.get(BlockchainReaderService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();

    describe('native token validation', () => {
      it('should return true when creator has sufficient native balance', async () => {
        blockchainReaderService.getBalance.mockResolvedValue(BigInt(2000000000000000000)); // 2 ETH

        const result = await validation.validate(mockIntent);

        expect(result).toBe(true);
        expect(blockchainReaderService.getBalance).toHaveBeenCalledWith(
          mockIntent.route.source,
          mockIntent.reward.creator,
        );
      });

      it('should throw error when creator has insufficient native balance', async () => {
        blockchainReaderService.getBalance.mockResolvedValue(BigInt(500000000000000000)); // 0.5 ETH

        await expect(validation.validate(mockIntent)).rejects.toThrow(
          'Insufficient native token balance. Required: 1000000000000000000, Available: 500000000000000000',
        );
      });

      it('should skip native balance check when nativeValue is 0', async () => {
        const intentWithoutNative = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(0),
          },
        });

        const result = await validation.validate(intentWithoutNative);

        expect(result).toBe(true);
        expect(blockchainReaderService.getBalance).not.toHaveBeenCalled();
      });
    });

    describe('token validation', () => {
      it('should return true when creator has sufficient token balances', async () => {
        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000),
              },
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(2000),
              },
            ],
          },
        });

        blockchainReaderService.getBalance.mockResolvedValue(BigInt(2000000000000000000));
        blockchainReaderService.getTokenBalance
          .mockResolvedValueOnce(BigInt(1500)) // First token
          .mockResolvedValueOnce(BigInt(3000)); // Second token

        const result = await validation.validate(intentWithTokens);

        expect(result).toBe(true);
        expect(blockchainReaderService.getTokenBalance).toHaveBeenCalledTimes(2);
        expect(blockchainReaderService.getTokenBalance).toHaveBeenNthCalledWith(
          1,
          mockIntent.route.source,
          '0x1111111111111111111111111111111111111111',
          mockIntent.reward.creator,
        );
        expect(blockchainReaderService.getTokenBalance).toHaveBeenNthCalledWith(
          2,
          mockIntent.route.source,
          '0x2222222222222222222222222222222222222222',
          mockIntent.reward.creator,
        );
      });

      it('should throw error when creator has insufficient token balance', async () => {
        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000),
              },
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(2000),
              },
            ],
          },
        });

        blockchainReaderService.getBalance.mockResolvedValue(BigInt(2000000000000000000));
        blockchainReaderService.getTokenBalance
          .mockResolvedValueOnce(BigInt(1500)) // First token - sufficient
          .mockResolvedValueOnce(BigInt(1500)); // Second token - insufficient

        await expect(validation.validate(intentWithTokens)).rejects.toThrow(
          'Insufficient token balance for 0x2222222222222222222222222222222222222222. Required: 2000, Available: 1500',
        );
      });
    });

    describe('combined validation', () => {
      it('should validate both native and token balances', async () => {
        const intentWithBoth = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(1000000000000000000), // 1 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000),
              },
            ],
          },
        });

        blockchainReaderService.getBalance.mockResolvedValue(BigInt(2000000000000000000)); // 2 ETH
        blockchainReaderService.getTokenBalance.mockResolvedValue(BigInt(1500));

        const result = await validation.validate(intentWithBoth);

        expect(result).toBe(true);
        expect(blockchainReaderService.getBalance).toHaveBeenCalled();
        expect(blockchainReaderService.getTokenBalance).toHaveBeenCalled();
      });

      it('should check token balances first, then native balance', async () => {
        const intentWithBoth = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(1000000000000000000),
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000),
              },
            ],
          },
        });

        blockchainReaderService.getBalance.mockResolvedValue(BigInt(500000000000000000)); // Insufficient

        await expect(validation.validate(intentWithBoth)).rejects.toThrow(
          'Insufficient native token balance. Required: 1000000000000000000, Available: 500000000000000000',
        );

        expect(blockchainReaderService.getTokenBalance).toHaveBeenCalled();
        expect(blockchainReaderService.getBalance).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should propagate errors from blockchain reader service', async () => {
        const error = new Error('RPC connection failed');
        blockchainReaderService.getBalance.mockRejectedValue(error);

        await expect(validation.validate(mockIntent)).rejects.toThrow(
          'Failed to verify native token balance: RPC connection failed',
        );
      });

      it('should handle edge case with no native value and no tokens', async () => {
        const emptyIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(0),
          },
          route: {
            ...mockIntent.route,
            tokens: [],
          },
        });

        const result = await validation.validate(emptyIntent);

        expect(result).toBe(true);
        expect(blockchainReaderService.getBalance).not.toHaveBeenCalled();
        expect(blockchainReaderService.getTokenBalance).not.toHaveBeenCalled();
      });
    });
  });
});
