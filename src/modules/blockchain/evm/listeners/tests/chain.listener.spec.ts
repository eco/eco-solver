import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntentSourceAbi } from '@eco-foundation/routes-ts';
import { Address, Hex } from 'viem';

import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';

import { ChainListener } from '../chain.listener';

describe('ChainListener', () => {
  let listener: ChainListener;
  let transportService: jest.Mocked<EvmTransportService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let mockPublicClient: any;
  let mockUnsubscribe: jest.Mock;

  const mockConfig: EvmChainConfig = {
    chainType: 'EVM',
    chainId: 1,
    intentSourceAddress: '0xIntentSourceAddress' as Address,
    inboxAddress: '0xInboxAddress' as Address,
  };

  const mockLog = {
    args: {
      hash: '0xIntentHash' as Hex,
      prover: '0xProverAddress' as Address,
      creator: '0xCreatorAddress' as Address,
      deadline: 1234567890n,
      nativeValue: 1000000000000000000n,
      rewardTokens: [
        { token: '0xToken1' as Address, amount: 100n },
        { token: '0xToken2' as Address, amount: 200n },
      ],
      source: 1n,
      destination: 10n,
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      inbox: '0xInboxAddress' as Address,
      calls: [
        {
          target: '0xTarget1' as Address,
          data: '0xData1' as Hex,
          value: 0n,
        },
      ],
      routeTokens: [{ token: '0xRouteToken1' as Address, amount: 300n }],
    },
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

    listener = new ChainListener(mockConfig, transportService, eventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start watching for IntentCreated events', async () => {
      await listener.start();

      expect(transportService.getPublicClient).toHaveBeenCalledWith(1);
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith({
        abi: IntentSourceAbi,
        eventName: 'IntentCreated',
        address: '0xIntentSourceAddress',
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
          reward: {
            prover: '0xProverAddress',
            creator: '0xCreatorAddress',
            deadline: 1234567890n,
            nativeValue: 1000000000000000000n,
            tokens: [
              { token: '0xToken1', amount: 100n },
              { token: '0xToken2', amount: 200n },
            ],
          },
          route: {
            source: 1n,
            destination: 10n,
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            inbox: '0xInboxAddress',
            calls: [
              {
                target: '0xTarget1',
                data: '0xData1',
                value: 0n,
              },
            ],
            tokens: [{ token: '0xRouteToken1', amount: 300n }],
          },
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
          hash: '0xIntentHash2' as Hex,
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
          routeTokens: [],
        },
      };

      onLogsCallback([logWithoutTokens]);

      expect(eventEmitter.emit).toHaveBeenCalledWith('intent.discovered', {
        intent: expect.objectContaining({
          reward: expect.objectContaining({
            tokens: [],
          }),
          route: expect.objectContaining({
            tokens: [],
          }),
        }),
        strategy: 'standard',
      });
    });

    it('should handle empty calls', async () => {
      await listener.start();

      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      const logWithoutCalls = {
        ...mockLog,
        args: {
          ...mockLog.args,
          calls: [],
        },
      };

      onLogsCallback([logWithoutCalls]);

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
    it('should use correct intent source address from config', async () => {
      const customConfig: EvmChainConfig = {
        ...mockConfig,
        intentSourceAddress: '0xCustomIntentSource' as Address,
      };

      const customListener = new ChainListener(customConfig, transportService, eventEmitter);
      await customListener.start();

      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0xCustomIntentSource',
        }),
      );
    });

    it('should use correct chain ID from config', async () => {
      const customConfig: EvmChainConfig = {
        ...mockConfig,
        chainId: 10,
      };

      const customListener = new ChainListener(customConfig, transportService, eventEmitter);
      await customListener.start();

      expect(transportService.getPublicClient).toHaveBeenCalledWith(10);
    });
  });
});
