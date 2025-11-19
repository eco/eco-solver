import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { EvmWalletManager } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { IntentsService } from '@/modules/intents/intents.service';

import { waitForApp } from '../helpers/test-app.helper';

/**
 * E2E Test Context
 *
 * Contains all services and dependencies needed by E2E tests,
 * plus a cleanup function to close the app.
 *
 * Usage:
 *   let ctx: E2ETestContext;
 *   let cleanup: () => Promise<void>;
 *
 *   beforeAll(async () => {
 *     const result = await setupTestContext();
 *     ctx = result.context;
 *     cleanup = result.cleanup;
 *   });
 *
 *   afterAll(async () => {
 *     await cleanup();
 *   });
 *
 *   it('test case', async () => {
 *     await waitForFulfillment(intentHash, ctx);
 *   });
 */
export interface E2ETestContext {
  /**
   * The NestJS application instance for this test file
   */
  app: INestApplication;

  /**
   * Base URL of the running application (e.g., http://localhost:3001)
   */
  baseUrl: string;

  /**
   * IntentsService for database operations
   */
  intentsService: IntentsService;

  /**
   * EvmWalletManager for accessing wallet addresses
   */
  evmWalletManager: EvmWalletManager;
}

/**
 * Setup E2E Test Context
 *
 * Creates a fresh NestJS application instance and retrieves all necessary services.
 * Call this in your test file's beforeAll() hook, and call the returned cleanup
 * function in afterAll() to properly close the app.
 *
 * @returns Object containing the test context and cleanup function
 */
export async function setupTestContext(): Promise<{
  context: E2ETestContext;
  cleanup: () => Promise<void>;
}> {
  console.log('\n🚀 Creating NestJS app instance for E2E test...');

  // Create testing module with full AppModule
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Create app instance
  const app = moduleFixture.createNestApplication();

  // Apply same configuration as production app (from src/main.ts)

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for testing
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Get port from config (defaults to 3001 for E2E tests)
  const port = process.env.PORT || 3001;

  // Start listening
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ App listening at ${baseUrl}`);

  // Wait for lifecycle hooks to start (OnModuleInit, OnApplicationBootstrap)
  // These hooks run AFTER app.listen() returns and include:
  // - Leader election initialization
  // - Queue service resumption
  // - Blockchain listener startup
  console.log('⏳ Waiting for lifecycle hooks to initialize...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Wait for app to be fully ready (checks MongoDB and Redis connections)
  await waitForApp(baseUrl);
  console.log('✅ App fully initialized and ready');

  // Get services from the app
  const intentsService = app.get(IntentsService);
  const evmWalletManager = app.get(EvmWalletManager);

  // Create cleanup function
  const cleanup = async () => {
    console.log('\n🛑 Closing app instance...');
    try {
      await app.close();
      console.log('✅ App closed successfully');
    } catch (error) {
      console.error('❌ Error closing app:', error);
      throw error;
    }
  };

  // Return context with all dependencies and cleanup function
  return {
    context: {
      app,
      baseUrl,
      intentsService,
      evmWalletManager,
    },
    cleanup,
  };
}
