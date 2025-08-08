import { Test } from '@nestjs/testing';

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ProverService } from '@/modules/prover/prover.service';

import { ExpirationValidation } from '../expiration.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('ExpirationValidation', () => {
  let validation: ExpirationValidation;
  let proverService: jest.Mocked<ProverService>;

  beforeEach(async () => {
    const mockFulfillmentConfigService = {
      get deadlineDuration() {
        return 0; // Default value
      },
    };

    const mockProverService = {
      getMaxDeadlineBuffer: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExpirationValidation,
        {
          provide: FulfillmentConfigService,
          useValue: mockFulfillmentConfigService,
        },
        {
          provide: ProverService,
          useValue: mockProverService,
        },
      ],
    }).compile();

    validation = module.get<ExpirationValidation>(ExpirationValidation);
    proverService = module.get(ProverService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent({
      reward: {
        ...createMockIntent().reward,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now in seconds
      },
    });
    const mockContext = createMockValidationContext();

    beforeEach(() => {
      // Mock Date.now() for consistent testing
      jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('deadline existence', () => {
      it('should throw error when deadline is missing', async () => {
        const intentWithoutDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: undefined as any,
          },
        });

        await expect(validation.validate(intentWithoutDeadline, mockContext)).rejects.toThrow(
          'Intent must have a deadline',
        );
      });

      it('should throw error when deadline is zero', async () => {
        const intentWithZeroDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: BigInt(0),
          },
        });

        await expect(validation.validate(intentWithZeroDeadline, mockContext)).rejects.toThrow(
          'Intent must have a deadline',
        );
      });
    });

    describe('deadline expiration', () => {
      it('should return true when deadline is in the future with sufficient buffer', async () => {
        const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 7200); // 2 hours from now in seconds
        const intentWithFutureDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: futureDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(3600n); // 1 hour buffer in seconds

        const result = await validation.validate(intentWithFutureDeadline, mockContext);

        expect(result).toBe(true);
        expect(proverService.getMaxDeadlineBuffer).toHaveBeenCalledWith(
          Number(intentWithFutureDeadline.route.source),
          Number(intentWithFutureDeadline.route.destination),
        );
      });

      it('should throw error when deadline has already passed', async () => {
        const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago in seconds
        const intentWithPastDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: pastDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(1800n); // 30 min buffer in seconds

        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        await expect(validation.validate(intentWithPastDeadline, mockContext)).rejects.toThrow(
          `Intent deadline ${pastDeadline} has expired. Current time: ${currentTime}`,
        );
      });

      it('should throw error when deadline is exactly current time', async () => {
        const currentDeadline = BigInt(Math.floor(Date.now() / 1000));
        const intentWithCurrentDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: currentDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(1800n); // 30 min buffer in seconds

        await expect(validation.validate(intentWithCurrentDeadline, mockContext)).rejects.toThrow(
          `Intent deadline ${currentDeadline} has expired. Current time: ${currentDeadline}`,
        );
      });
    });

    describe('buffer validation', () => {
      it('should throw error when deadline is within buffer period', async () => {
        const nearDeadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes from now in seconds
        const intentWithNearDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: nearDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(3600n); // 1 hour buffer in seconds

        await expect(validation.validate(intentWithNearDeadline, mockContext)).rejects.toThrow(
          `Intent deadline ${nearDeadline} is too close. Need at least 3600 seconds buffer for this route`,
        );
      });

      it('should fail when deadline exactly meets buffer requirement', async () => {
        const bufferSeconds = 3600n; // 1 hour in seconds
        const exactBufferDeadline = BigInt(Math.floor(Date.now() / 1000)) + bufferSeconds;
        const intentWithExactBuffer = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: exactBufferDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(bufferSeconds);

        await expect(validation.validate(intentWithExactBuffer, mockContext)).rejects.toThrow(
          `Intent deadline ${exactBufferDeadline} is too close. Need at least ${bufferSeconds} seconds buffer for this route`,
        );
      });

      it('should handle zero buffer', async () => {
        const nearDeadline = BigInt(Math.floor(Date.now() / 1000) + 1); // 1 second from now
        const intentWithNearDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: nearDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(0n); // No buffer

        const result = await validation.validate(intentWithNearDeadline, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle very large deadline values', async () => {
        const farFutureDeadline = BigInt('9999999999999999999'); // Very far in the future
        const intentWithFarDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: farFutureDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(3600n); // 1 hour in seconds

        const result = await validation.validate(intentWithFarDeadline, mockContext);

        expect(result).toBe(true);
      });

      it('should handle deadline as seconds', async () => {
        // The system uses seconds since epoch
        const deadlineInSeconds = BigInt(Math.floor(Date.now() / 1000) + 7200); // 2 hours from now in seconds
        const intentWithSecondsDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: deadlineInSeconds,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(3600n); // 1 hour in seconds

        // This should pass because the validation uses seconds
        const result = await validation.validate(intentWithSecondsDeadline, mockContext);

        expect(result).toBe(true);
      });

      it('should use prover-specific buffers for different routes', async () => {
        const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now in seconds
        const intentWithRoute = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: futureDeadline,
          },
          route: {
            ...mockIntent.route,
            source: 1n,
            destination: 10n,
          },
        });

        // Prover returns 600 seconds for this specific route
        proverService.getMaxDeadlineBuffer.mockReturnValue(600n);

        const result = await validation.validate(intentWithRoute, mockContext);

        expect(result).toBe(true);
        expect(proverService.getMaxDeadlineBuffer).toHaveBeenCalledWith(1, 10);
      });
    });

    describe('time precision', () => {
      it('should handle second precision correctly', async () => {
        const preciseDeadline = BigInt(Math.floor(Date.now() / 1000) + 3601); // Exactly 1 hour and 1 second
        const intentWithPreciseDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: preciseDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(3600n); // Exactly 1 hour

        const result = await validation.validate(intentWithPreciseDeadline, mockContext);

        expect(result).toBe(true); // Should pass as it's 1 second over the buffer
      });

      it('should fail when 1 second under buffer requirement', async () => {
        const preciseDeadline = BigInt(Math.floor(Date.now() / 1000) + 3599); // 1 second under 1 hour
        const intentWithPreciseDeadline = createMockIntent({
          reward: {
            ...mockIntent.reward,
            deadline: preciseDeadline,
          },
        });

        proverService.getMaxDeadlineBuffer.mockReturnValue(3600n); // Exactly 1 hour

        await expect(validation.validate(intentWithPreciseDeadline, mockContext)).rejects.toThrow(
          `Intent deadline ${preciseDeadline} is too close. Need at least 3600 seconds buffer for this route`,
        );
      });
    });
  });
});
