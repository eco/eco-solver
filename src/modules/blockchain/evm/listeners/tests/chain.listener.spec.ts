import { Address, Hex } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';

import { ChainListener } from '../chain.listener';

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
    denormalizeToEvm: jest.fn((_universalAddress) => {
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

// No need to mock event parsers anymore - events are queued directly

// Mock QueueSerializer
jest.mock('@/common/utils/bigint-serializer', () => ({
  QueueSerializer: {
    serialize: jest.fn((_obj) => 'serialized-object'),
  },
}));

describe('ChainListener', () => {
  let listener: ChainListener;
  let transportService: jest.Mocked<EvmTransportService>;
  let logger: jest.Mocked<Logger>;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let queueService: jest.Mocked<any>;
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
      hasPollingTransport: jest.fn().mockReturnValue(false),
    } as any;

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    blockchainConfigService = {
      getPortalAddress: jest
        .fn()
        .mockReturnValue(
          '0x00000000000000000000000PORTALADDRESS0000000000000000000000000000000001',
        ),
    } as any;

    evmConfigService = {
      getChain: jest.fn().mockReturnValue({
        chainId: 1,
        provers: {},
      }),
    } as any;

    queueService = {
      addBlockchainEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    listener = new ChainListener(
      mockConfig,
      transportService,
      logger,
      blockchainConfigService,
      evmConfigService,
      queueService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start watching for IntentPublished events', async () => {
      await listener.start();

      expect(transportService.getPublicClient).toHaveBeenCalledWith(1);
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          abi: portalAbi,
          eventName: 'IntentPublished',
          address: '0xPortalAddress',
          strict: true,
          onLogs: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    it('should process logs and queue blockchain event', async () => {
      await listener.start();

      // Get the onLogs callback
      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      // Simulate receiving logs
      await onLogsCallback([mockLog]);

      expect(queueService.addBlockchainEvent).toHaveBeenCalledWith({
        eventType: 'IntentPublished',
        chainId: 1,
        chainType: 'evm',
        contractName: 'portal',
        intentHash: '0xIntentHash',
        eventData: mockLog,
        metadata: {
          txHash: '0xTxHash',
          blockNumber: 1234n,
          logIndex: undefined,
          contractAddress: '0xPortalAddress',
        },
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

      await onLogsCallback([mockLog, log2]);

      expect(queueService.addBlockchainEvent).toHaveBeenCalledTimes(2);
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

      await onLogsCallback([logWithoutTokens]);

      expect(queueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentPublished',
          intentHash: '0xIntentHash',
        }),
      );
    });

    it('should queue events properly', async () => {
      await listener.start();

      const onLogsCallback = mockPublicClient.watchContractEvent.mock.calls[0][0].onLogs;

      await onLogsCallback([mockLog]);

      expect(queueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentPublished',
          chainId: 1,
          chainType: 'evm',
          contractName: 'portal',
        }),
      );
    });
  });

  describe('stop', () => {
    it('should unsubscribe from event watching', async () => {
      await listener.start();
      await listener.stop();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(3); // Called for IntentPublished, IntentFulfilled, and IntentWithdrawn (0 provers configured)
    });

    it('should handle stop without start', async () => {
      await listener.stop();

      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should handle multiple stop calls', async () => {
      await listener.start();
      await listener.stop();
      await listener.stop();

      // Called twice for each subscription (3 subscriptions x 2 stop calls = 6)
      expect(mockUnsubscribe).toHaveBeenCalledTimes(6);
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

      // queueService throws error
      queueService.addBlockchainEvent.mockRejectedValue(new Error('Queue error'));

      // Should not throw - errors in callback are logged
      await expect(onLogsCallback([mockLog])).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use correct portal address from blockchain config service', async () => {
      const customPortalUniversalAddress =
        '0x00000000000000000000000CUSTOMPORTAL0000000000000000000000000000000001' as any;
      blockchainConfigService.getPortalAddress.mockReturnValue(customPortalUniversalAddress);

      // Mock the denormalizeToEvm to return the expected custom address for this test
      const { AddressNormalizer } = await import('@/common/utils/address-normalizer');
      (AddressNormalizer.denormalizeToEvm as jest.Mock).mockReturnValue('0xCustomPortal');

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
        logger,
        blockchainConfigService,
        evmConfigService,
        queueService,
      );
      await customListener.start();

      expect(transportService.getPublicClient).toHaveBeenCalledWith(10);
    });
  });

  describe('IntentFulfilled event handling', () => {
    let intentFulfilledCallback: (logs: any[]) => void;

    beforeEach(async () => {
      // Reset mocks
      jest.clearAllMocks();

      await listener.start();

      // Get the IntentFulfilled callback (should be the second watchContractEvent call)
      const calls = mockPublicClient.watchContractEvent.mock.calls;
      const intentFulfilledCall = calls.find(
        (call: any) => call[0].eventName === 'IntentFulfilled',
      );
      if (intentFulfilledCall) {
        intentFulfilledCallback = intentFulfilledCall[0].onLogs;
      }
    });

    it('should watch for IntentFulfilled events', () => {
      // Check that watchContractEvent was called for IntentFulfilled
      const calls = mockPublicClient.watchContractEvent.mock.calls;
      const intentFulfilledCall = calls.find(
        (call: any) => call[0].eventName === 'IntentFulfilled',
      );

      expect(intentFulfilledCall).toBeDefined();
      expect(intentFulfilledCall[0]).toMatchObject({
        abi: portalAbi,
        eventName: 'IntentFulfilled',
        address: expect.any(String), // The address is denormalized from universal format
        strict: true,
        onLogs: expect.any(Function),
      });
    });

    it('should queue IntentFulfilled event when received', async () => {
      const mockLog = {
        args: {
          intentHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          claimant: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        },
        transactionHash: '0xfedcba9876543210',
        blockNumber: 12345678n,
      };

      // Ensure callback was set
      expect(intentFulfilledCallback).toBeDefined();

      // Trigger the IntentFulfilled callback
      await intentFulfilledCallback([mockLog]);

      expect(queueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentFulfilled',
          chainId: mockConfig.chainId,
          chainType: 'evm',
          contractName: 'portal',
          intentHash: mockLog.args.intentHash,
          eventData: mockLog,
          metadata: expect.objectContaining({
            txHash: mockLog.transactionHash,
            blockNumber: mockLog.blockNumber,
            logIndex: undefined,
          }),
        }),
      );
    });

    it('should handle errors in IntentFulfilled processing', async () => {
      const mockLog = {
        args: {
          intentHash: '0x1234',
          claimant: '0xabcd',
        },
        transactionHash: '0xfedcba',
        blockNumber: 12345678n,
      };

      // Ensure callback was set
      expect(intentFulfilledCallback).toBeDefined();

      // Mock queueService to throw an error
      queueService.addBlockchainEvent.mockRejectedValueOnce(new Error('Queue error'));

      // Should not throw, just log error
      await expect(intentFulfilledCallback([mockLog])).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to queue IntentFulfilled event'),
        expect.any(Error),
      );
    });

    it('should handle multiple IntentFulfilled events', async () => {
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

      // Ensure callback was set
      expect(intentFulfilledCallback).toBeDefined();

      await intentFulfilledCallback(mockLogs);

      expect(queueService.addBlockchainEvent).toHaveBeenCalledTimes(2);
      expect(queueService.addBlockchainEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          eventType: 'IntentFulfilled',
          intentHash: mockLogs[0].args.intentHash,
        }),
      );
      expect(queueService.addBlockchainEvent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          eventType: 'IntentFulfilled',
          intentHash: mockLogs[1].args.intentHash,
        }),
      );
    });
  });
});
