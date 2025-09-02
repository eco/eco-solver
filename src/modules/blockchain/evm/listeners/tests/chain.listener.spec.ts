import { Address, Hex } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { createMockEventsService } from '@/modules/events/tests/events.service.mock';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { ChainListener } from '../chain.listener';
import * as eventsModule from '../utils/events';

// Mock AddressNormalizer at module level
jest.mock('@/common/utils/address-normalizer', () => ({
  AddressNormalizer: {
    normalize: jest.fn((address) => {
      // Return a mock UniversalAddress format (66 chars)
      const cleanAddress = address.replace('0x', '').toUpperCase();
      // Ensure the address part is exactly 40 chars and pad the result to 66 chars total
      const paddedAddress = cleanAddress.padEnd(40, '0').substring(0, 40);
      return `0x00000000000000000000000${paddedAddress}0001`;
    }),
    denormalizeToEvm: jest.fn((universalAddress) => {
      // For testing, just return the mock portal address when called
      return '0xPortalAddress';
    }),
  },
}));

// Mock PortalEncoder at module level
jest.mock('@/common/utils/portal-encoder', () => ({
  PortalEncoder: {
    decodeFromChain: jest.fn().mockReturnValue({
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      deadline: 1234567890n,
      portal: '0x000000000000000000000000PORTALADDRESS0000000000000000000000000000000001',
      nativeAmount: 0n,
      tokens: [
        {
          token: '0x000000000000000000000000ROUTETOKEN10000000000000000000000000000000001',
          amount: 300n,
        },
      ],
      calls: [
        {
          target: '0x000000000000000000000000TARGET10000000000000000000000000000000000000001',
          data: '0xData1',
          value: 0n,
        },
      ],
    }),
  },
}));

// Mock parseIntentPublish function
jest.mock('@/modules/blockchain/evm/utils/events', () => ({
  parseIntentPublish: jest.fn((sourceChainId, log) => ({
    intentHash: log.args.intentHash,
    destination: log.args.destination,
    sourceChainId,
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      deadline: 1234567890n,
      portal: '0x000000000000000000000000PORTALADDRESS0000000000000000000000000000000001',
      nativeAmount: 0n,
      tokens: [
        {
          token: '0x000000000000000000000000ROUTETOKEN10000000000000000000000000000000001',
          amount: 300n,
        },
      ],
      calls: [
        {
          target: '0x000000000000000000000000TARGET10000000000000000000000000000000000000001',
          data: '0xData1',
          value: 0n,
        },
      ],
    },
    reward: {
      deadline: log.args.rewardDeadline,
      creator: '0x00000000000000000000000CREATORADDRESS000000000000000000000000000001',
      prover: '0x00000000000000000000000PROVERADDRESS0000000000000000000000000000001',
      nativeAmount: log.args.rewardNativeAmount,
      tokens: log.args.rewardTokens.map((token, index) => ({
        amount: token.amount,
        token: `0x00000000000000000000000TOKEN${index + 1}00000000000000000000000000000000000001`,
      })),
    },
  })),
}));

// Mock QueueSerializer
jest.mock('@/modules/queue/utils/queue-serializer', () => ({
  QueueSerializer: {
    serialize: jest.fn((obj) => 'serialized-object'),
  },
}));

describe('ChainListener', () => {
  let listener: ChainListener;
  let transportService: jest.Mocked<EvmTransportService>;
  let eventsService: ReturnType<typeof createMockEventsService>;
  let logger: jest.Mocked<SystemLoggerService>;
  let otelService: jest.Mocked<OpenTelemetryService>;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockPublicClient: any;
  let mockUnsubscribe: jest.Mock;

  const mockConfig: EvmChainConfig = {
    chainType: 'EVM',
    chainId: 1,
    portalAddress: '0xPortalAddress' as Address,
  };

  const mockLog = {
    args: {
      intentHash: '0xIntentHash' as Hex,
      creator: '0xCreatorAddress' as Address,
      prover: '0xProverAddress' as Address,
      destination: 10n,
      rewardNativeAmount: 1000000000000000000n,
      rewardDeadline: 1234567890n,
      rewardTokens: [
        { token: '0xToken1' as Address, amount: 100n },
        { token: '0xToken2' as Address, amount: 200n },
      ],
      route:
        '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003',
    },
    blockNumber: 1234n,
    transactionHash: '0xTxHash' as Hex,
  };

  beforeEach(() => {
    mockUnsubscribe = jest.fn();
    mockPublicClient = {
      watchContractEvent: jest.fn().mockReturnValue(mockUnsubscribe),
    };

    transportService = {
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
    } as any;

    eventsService = createMockEventsService();

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    otelService = {
      startSpan: jest.fn().mockReturnValue({
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      }),
    } as any;

    blockchainConfigService = {
      getPortalAddress: jest
        .fn()
        .mockReturnValue(
          '0x00000000000000000000000PORTALADDRESS0000000000000000000000000000000001',
        ),
    } as any;

    listener = new ChainListener(
      mockConfig,
      transportService,
      eventsService as any,
      logger,
      otelService,
      blockchainConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start watching for IntentPublished events', async () => {
      await listener.start();

      expect(transportService.getPublicClient).toHaveBeenCalledWith(1);
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith({
        abi: PortalAbi,
        eventName: 'IntentPublished',
        address: '0xPortalAddress',
        strict: true,
        onLogs: expect.any(Function),
      });
    });

    it('should process logs and emit intent.discovered event', async () => {
      await listener.start();

      // Get the onLogs callback
      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      // Simulate receiving logs
      onLogsCallback([mockLog]);

      expect(eventsService.emit).toHaveBeenCalledWith('intent.discovered', {
        intent: {
          intentHash: '0xIntentHash',
          destination: 10n,
          route: {
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            deadline: 1234567890n,
            portal: '0x000000000000000000000000PORTALADDRESS0000000000000000000000000000000001',
            nativeAmount: 0n,
            tokens: [
              {
                token: '0x000000000000000000000000ROUTETOKEN10000000000000000000000000000000001',
                amount: 300n,
              },
            ],
            calls: [
              {
                target: '0x000000000000000000000000TARGET10000000000000000000000000000000000000001',
                data: '0xData1',
                value: 0n,
              },
            ],
          },
          reward: {
            deadline: 1234567890n,
            creator: '0x00000000000000000000000CREATORADDRESS000000000000000000000000000001',
            prover: '0x00000000000000000000000PROVERADDRESS0000000000000000000000000000001',
            nativeAmount: 1000000000000000000n,
            tokens: [
              {
                token: '0x00000000000000000000000TOKEN100000000000000000000000000000000000001',
                amount: 100n,
              },
              {
                token: '0x00000000000000000000000TOKEN200000000000000000000000000000000000001',
                amount: 200n,
              },
            ],
          },
          sourceChainId: 1n,
        },
        strategy: 'standard',
      });
    });

    it('should handle multiple logs', async () => {
      await listener.start();

      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      const log2 = {
        ...mockLog,
        args: {
          ...mockLog.args,
          intentHash: '0xIntentHash2' as Hex,
        },
      };

      onLogsCallback([mockLog, log2]);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });

    it('should handle empty reward tokens', async () => {
      await listener.start();

      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      const logWithoutTokens = {
        ...mockLog,
        args: {
          ...mockLog.args,
          rewardTokens: [],
        },
      };

      onLogsCallback([logWithoutTokens]);

      expect(eventsService.emit).toHaveBeenCalledWith('intent.discovered', {
        intent: expect.objectContaining({
          reward: expect.objectContaining({
            tokens: [],
          }),
        }),
        strategy: 'standard',
      });
    });

    it('should handle empty calls', async () => {
      await listener.start();

      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      // Mock parseIntentPublish to return an intent with empty calls for this specific test
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mockEventsModule = require('@/modules/blockchain/evm/utils/events');
      mockEventsModule.parseIntentPublish.mockReturnValueOnce({
        intentHash: mockLog.args.intentHash,
        destination: mockLog.args.destination,
        sourceChainId: 1n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
          deadline: 1234567890n,
          portal: '0x000000000000000000000000PORTALADDRESS0000000000000000000000000000000001',
          nativeAmount: 0n,
          tokens: [
            {
              token: '0x000000000000000000000000ROUTETOKEN10000000000000000000000000000000001',
              amount: 300n,
            },
          ],
          calls: [], // Empty calls for this test
        },
        reward: {
          deadline: mockLog.args.rewardDeadline,
          creator: '0x00000000000000000000000CREATORADDRESS000000000000000000000000000001',
          prover: '0x00000000000000000000000PROVERADDRESS0000000000000000000000000000001',
          nativeAmount: mockLog.args.rewardNativeAmount,
          tokens: mockLog.args.rewardTokens.map((token, index) => ({
            amount: token.amount,
            token: `0x00000000000000000000000TOKEN${index + 1}00000000000000000000000000000000000001`,
          })),
        },
      });

      onLogsCallback([mockLog]);

      expect(eventsService.emit).toHaveBeenCalledWith('intent.discovered', {
        intent: expect.objectContaining({
          route: expect.objectContaining({
            calls: [],
          }),
        }),
        strategy: 'standard',
      });
    });
  });

  describe('stop', () => {
    it('should unsubscribe from event watching', async () => {
      await listener.start();
      await listener.stop();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle stop without start', async () => {
      await listener.stop();

      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should handle multiple stop calls', async () => {
      await listener.start();
      await listener.stop();
      await listener.stop();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from transport service', async () => {
      const error = new Error('Transport error');
      transportService.getPublicClient.mockImplementation(() => {
        throw error;
      });

      await expect(listener.start()).rejects.toThrow(error);
    });

    it('should handle errors in event callback', async () => {
      await listener.start();

      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      // eventEmitter throws error
      eventEmitter.emit.mockImplementation(() => {
        throw new Error('Event emitter error');
      });

      // Should not throw - errors in callback are handled by viem
      expect(() => onLogsCallback([mockLog])).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should use correct portal address from blockchain config service', async () => {
      const customPortalUniversalAddress =
        '0x00000000000000000000000CUSTOMPORTAL0000000000000000000000000000000001' as any;
      blockchainConfigService.getPortalAddress.mockReturnValue(customPortalUniversalAddress);

      // Mock the denormalizeToEvm to return the expected custom address for this test
      const mockAddressNormalizer = require('@/common/utils/address-normalizer');
      mockAddressNormalizer.AddressNormalizer.denormalizeToEvm.mockReturnValue('0xCustomPortal');

      await listener.start();

      expect(blockchainConfigService.getPortalAddress).toHaveBeenCalledWith(1);
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0xCustomPortal',
        }),
      );
    });

    it('should use correct chain ID from config', async () => {
      const customConfig: EvmChainConfig = {
        ...mockConfig,
        chainId: 10,
      };

      const customListener = new ChainListener(
        customConfig,
        transportService,
        eventEmitter,
        logger,
        otelService,
        blockchainConfigService,
      );
      await customListener.start();

      expect(transportService.getPublicClient).toHaveBeenCalledWith(10);
    });
  });

  describe('IntentFulfilled event handling', () => {
    let mockPublicClient: any;
    let intentFulfilledCallback: Function;

    beforeEach(async () => {
      mockPublicClient = {
        watchContractEvent: jest.fn((config) => {
          if (config.eventName === 'IntentFulfilled') {
            intentFulfilledCallback = config.onLogs;
          }
          return jest.fn(); // Return unsubscribe function
        }),
      };
      transportService.getPublicClient.mockReturnValue(mockPublicClient);

      await listener.start();
    });

    it('should watch for IntentFulfilled events', () => {
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          abi: PortalAbi,
          eventName: 'IntentFulfilled',
          address: '0xPortalAddress',
          strict: true,
          onLogs: expect.any(Function),
        }),
      );
    });

    it('should emit intent.fulfilled event when IntentFulfilled is received', () => {
      const mockLog = {
        args: {
          intentHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          claimant: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        },
        transactionHash: '0xfedcba9876543210',
        blockNumber: 12345678n,
      };

      // Trigger the IntentFulfilled callback
      intentFulfilledCallback([mockLog]);

      expect(eventsService.emit).toHaveBeenCalledWith(
        'intent.fulfilled',
        expect.objectContaining({
          intentHash: mockLog.args.intentHash,
          claimant: mockLog.args.claimant,
          chainId: BigInt(mockConfig.chainId),
          transactionHash: mockLog.transactionHash,
          blockNumber: mockLog.blockNumber,
        }),
      );
    });

    it('should handle errors in IntentFulfilled processing', () => {
      const mockLog = {
        args: {
          intentHash: '0x1234',
          claimant: '0xabcd',
        },
        transactionHash: '0xfedcba',
        blockNumber: 12345678n,
      };

      // Mock parseIntentFulfilled to throw an error
      jest.spyOn(eventsModule, 'parseIntentFulfilled').mockImplementation(() => {
        throw new Error('Parse error');
      });

      // Should not throw, just log error
      expect(() => intentFulfilledCallback([mockLog])).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing IntentFulfilled event'),
        expect.any(Error),
      );
    });

    it('should handle multiple IntentFulfilled events', () => {
      const mockLogs = [
        {
          args: {
            intentHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            claimant: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          transactionHash: '0xaaa',
          blockNumber: 100n,
        },
        {
          args: {
            intentHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
            claimant: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
          transactionHash: '0xbbb',
          blockNumber: 101n,
        },
      ];

      intentFulfilledCallback(mockLogs);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        1,
        'intent.fulfilled',
        expect.objectContaining({
          intentHash: mockLogs[0].args.intentHash,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        2,
        'intent.fulfilled',
        expect.objectContaining({
          intentHash: mockLogs[1].args.intentHash,
        }),
      );
    });
  });
});
