import * as fs from 'fs';
import * as path from 'path';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { TvmNetworkConfig, TvmTransactionSettings } from '@/config/schemas';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { TronListener } from '../tron.listener';

describe('TronListener Integration - Real Blockchain Events', () => {
  let module: TestingModule;
  let tronListener: TronListener;
  let eventEmitter: EventEmitter2;
  let capturedEvents: any[] = [];

  // Real TRON mainnet configuration
  const realTvmConfig: TvmNetworkConfig = {
    chainId: 728126428, // TRON mainnet
    rpc: {
      fullNode: 'https://api.trongrid.io',
      solidityNode: 'https://api.trongrid.io',
      eventServer: 'https://api.trongrid.io',
      options: {},
    },
    // You'll need to provide the actual IntentSource contract address
    // This is a placeholder - replace with actual contract address
    intentSourceAddress: 'TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG',
    inboxAddress: 'TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN',
    fee: {
      tokens: {
        flatFee: '100000',
        scalarBps: 10,
      },
      native: {
        flatFee: '500000',
        scalarBps: 50,
      },
    },
    tokens: [],
    provers: {
      hyper: 'TXBv2UfhyZteqbAvsempfa26Avo8LQz9iG',
      metalayer: 'TMBTCnRTQpbFj48YU8MBBR8HJ9oXWc44xN',
    },
  };

  const transactionSettings: TvmTransactionSettings = {
    defaultFeeLimit: 150000000,
    maxTransactionAttempts: 30,
    transactionCheckInterval: 2000,
    listenerPollInterval: 3000,
  };

  // Mock logger with console output
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn().mockImplementation((...args) => console.log('[LOG]', ...args)),
    error: jest.fn().mockImplementation((...args) => console.error('[ERROR]', ...args)),
    warn: jest.fn().mockImplementation((...args) => console.warn('[WARN]', ...args)),
    debug: jest.fn().mockImplementation((...args) => console.debug('[DEBUG]', ...args)),
  };

  // Mock OpenTelemetry with logging
  const mockOtelService = {
    startSpan: jest.fn().mockImplementation((name, attrs) => {
      console.log(`[OTEL] Starting span: ${name}`, attrs);
      return {
        setAttribute: jest.fn().mockImplementation((key, value) => {
          console.log(`[OTEL] Set attribute: ${key} = ${value}`);
        }),
        setAttributes: jest.fn(),
        addEvent: jest.fn().mockImplementation((event, attrs) => {
          console.log(`[OTEL] Event: ${event}`, attrs);
        }),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn().mockImplementation(() => {
          console.log(`[OTEL] Ending span: ${name}`);
        }),
      };
    }),
  };

  beforeAll(async () => {
    // Increase timeout for real blockchain calls
    jest.setTimeout(30000);

    // Create event emitter that captures events
    eventEmitter = new EventEmitter2();
    eventEmitter.on('intent.discovered', (event) => {
      console.log('[EVENT] Intent discovered:', JSON.stringify(event, null, 2));
      capturedEvents.push(event);
    });

    module = await Test.createTestingModule({
      providers: [
        TvmUtilsService,
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

    const utilsService = module.get<TvmUtilsService>(TvmUtilsService);
    const logger = module.get<SystemLoggerService>(SystemLoggerService);
    const otelService = module.get<OpenTelemetryService>(OpenTelemetryService);

    // Create TronListener instance
    tronListener = new TronListener(
      realTvmConfig,
      transactionSettings,
      utilsService,
      eventEmitter,
      logger,
      otelService,
    );
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should fetch real events from block 75148742', async () => {
    console.log('=== Starting real blockchain event fetch test ===');
    console.log(`Target block: 75148742`);
    console.log(`IntentSource address: ${realTvmConfig.intentSourceAddress}`);

    // Set lastBlockNumber to just before our target block
    // We need to access the private property using bracket notation
    (tronListener as any).lastBlockNumber = 75148741;
    (tronListener as any).isRunning = true;

    console.log('Calling pollForEvents...');

    try {
      // Call the private pollForEvents method
      await (tronListener as any).pollForEvents();

      console.log('Poll completed successfully');

      // Log captured events
      console.log(`\nCaptured ${capturedEvents.length} events:`);
      capturedEvents.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`);
        console.log(
          JSON.stringify(
            event,
            (key, value) => {
              // Convert BigInt to string for JSON serialization
              return typeof value === 'bigint' ? value.toString() : value;
            },
            2,
          ),
        );
      });

      // Log OpenTelemetry span attributes
      const spanCalls = mockOtelService.startSpan.mock.calls;
      console.log('\nOpenTelemetry span attributes:');
      spanCalls.forEach((call) => {
        console.log(`Span: ${call[0]}`);
        console.log('Attributes:', call[1]);
      });

      // Check if any events were found
      if (capturedEvents.length === 0) {
        console.log('\nNo IntentCreated events found in the specified block range.');
        console.log('This could mean:');
        console.log('1. No IntentCreated events were emitted in block 75148742');
        console.log('2. The IntentSource contract address is incorrect');
        console.log('3. The block range needs adjustment');
      } else {
        // Verify event structure
        const firstEvent = capturedEvents[0];
        expect(firstEvent).toHaveProperty('intent');
        expect(firstEvent).toHaveProperty('strategy');

        const intent = firstEvent.intent;
        console.log('\nParsed intent structure:');
        console.log('- intentHash:', intent.intentHash);
        console.log('- source chain:', intent.sourceChainId.toString());
        console.log('- destination chain:', intent.destination.toString());
        console.log('- creator:', intent.reward.creator);
        console.log('- prover:', intent.reward.prover);
      }

      // Write output to file for inspection
      const outputPath = path.join(__dirname, 'tron-listener-test-output.json');
      const testOutput = {
        timestamp: new Date().toISOString(),
        targetBlock: 75148742,
        capturedEvents: capturedEvents.map((e) => ({
          ...e,
          intent: {
            ...e.intent,
            reward: {
              ...e.intent.reward,
              deadline: e.intent.reward.deadline.toString(),
              nativeAmount: e.intent.reward.nativeAmount.toString(),
              tokens: e.intent.reward.tokens.map((t: any) => ({
                ...t,
                amount: t.amount.toString(),
              })),
            },
            route: {
              ...e.intent.route,
              source: e.intent.sourceChainId.toString(),
              destination: e.intent.destination.toString(),
              calls: e.intent.route.calls.map((c: any) => ({
                ...c,
                value: c.value.toString(),
              })),
              tokens: e.intent.route.tokens.map((t: any) => ({
                ...t,
                amount: t.amount.toString(),
              })),
            },
          },
        })),
        otelSpans: mockOtelService.startSpan.mock.calls.map((call) => ({
          name: call[0],
          attributes: call[1],
        })),
      };

      fs.writeFileSync(outputPath, JSON.stringify(testOutput, null, 2));
      console.log(`Test output written to: ${outputPath}`);
    } catch (error) {
      console.error('Error during pollForEvents:', error);
      throw error;
    }
  });

  it.skip('should fetch events from a specific block range', async () => {
    console.log('\n=== Testing specific block range fetch ===');

    // Let's try a broader range around block 75148742
    const startBlock = 75148740;
    const endBlock = 75148745;

    console.log(`Fetching events from blocks ${startBlock} to ${endBlock}`);

    // Reset captured events
    capturedEvents = [];

    // Set lastBlockNumber to start of range
    (tronListener as any).lastBlockNumber = startBlock - 1;
    (tronListener as any).isRunning = true;

    // We need to mock getCurrentBlock to return our end block
    const tronWebClient = (tronListener as any).createTronWebClient();

    // Fetch events directly using TronWeb API
    try {
      const hexIntentSourceAddress = realTvmConfig.intentSourceAddress.startsWith('T')
        ? module.get<TvmUtilsService>(TvmUtilsService).toHex(realTvmConfig.intentSourceAddress)
        : realTvmConfig.intentSourceAddress;

      console.log(`Fetching events for contract: ${hexIntentSourceAddress}`);

      const events = await tronWebClient.event.getEventsByContractAddress(hexIntentSourceAddress, {
        onlyConfirmed: true,
        minBlockTimestamp: startBlock,
        maxBlockTimestamp: endBlock,
        orderBy: 'block_timestamp,asc',
        limit: 200,
      });

      console.log(`\nRaw events response:`, JSON.stringify(events, null, 2));

      if (events && Array.isArray(events)) {
        console.log(`Found ${events.length} total events`);

        const intentCreatedEvents = events.filter((e) => e.event_name === 'IntentCreated');
        console.log(`Found ${intentCreatedEvents.length} IntentCreated events`);

        intentCreatedEvents.forEach((event, index) => {
          console.log(`\nIntentCreated Event ${index + 1}:`);
          console.log('- Block:', event.block_number);
          console.log('- Transaction:', event.transaction_id);
          console.log('- Event data:', JSON.stringify(event.result, null, 2));
        });
      } else {
        console.log('No events found or unexpected response format');
      }
    } catch (error) {
      console.error('Error fetching events directly:', error);
      throw error;
    }
  });
});
