import { EventEmitter2 } from '@nestjs/event-emitter';

import { Address, Hex } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { ChainListener } from '../chain.listener';

// Mock PortalEncoder at module level
jest.mock('@/common/utils/portal-encoder', () => ({
  PortalEncoder: {
    decodeFromChain: jest.fn().mockReturnValue({
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      deadline: 1234567890n,
      portal: '0xPortalAddress',
      nativeAmount: 0n,
      tokens: [{ token: '0xRouteToken1', amount: 300n }],
      calls: [
        {
          target: '0xTarget1',
          data: '0xData1',
          value: 0n,
        },
      ],
    }),
  },
}));

describe('ChainListener', () => {
  let listener: ChainListener;
  let transportService: jest.Mocked<EvmTransportService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
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

    eventEmitter = {
      emit: jest.fn(),
    } as any;

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
      getPortalAddress: jest.fn().mockReturnValue('0xPortalAddress'),
    } as any;

    listener = new ChainListener(
      mockConfig,
      transportService,
      eventEmitter,
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

      expect(eventEmitter.emit).toHaveBeenCalledWith('intent.discovered', {
        intent: {
          intentHash: '0xIntentHash',
          destination: 10n,
          route: {
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            deadline: 1234567890n,
            portal: '0xPortalAddress',
            nativeAmount: 0n,
            tokens: [{ token: '0xRouteToken1', amount: 300n }],
            calls: [
              {
                target: '0xTarget1',
                data: '0xData1',
                value: 0n,
              },
            ],
          },
          reward: {
            deadline: 1234567890n,
            creator: '0xCreatorAddress',
            prover: '0xProverAddress',
            nativeAmount: 1000000000000000000n,
            tokens: [
              { token: '0xToken1', amount: 100n },
              { token: '0xToken2', amount: 200n },
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

      expect(eventEmitter.emit).toHaveBeenCalledWith('intent.discovered', {
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

      // Mock PortalEncoder to return empty calls
      const mockPortalEncoder = require('@/common/utils/portal-encoder');
      mockPortalEncoder.PortalEncoder.decodeFromChain.mockReturnValueOnce({
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
        deadline: 1234567890n,
        portal: '0xPortalAddress',
        nativeAmount: 0n,
        tokens: [{ token: '0xRouteToken1', amount: 300n }],
        calls: [],
      });

      onLogsCallback([mockLog]);

      expect(eventEmitter.emit).toHaveBeenCalledWith('intent.discovered', {
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
      const customPortalAddress = '0xCustomPortal';
      blockchainConfigService.getPortalAddress.mockReturnValue(customPortalAddress);

      await listener.start();

      expect(blockchainConfigService.getPortalAddress).toHaveBeenCalledWith(1);
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: customPortalAddress,
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
});
