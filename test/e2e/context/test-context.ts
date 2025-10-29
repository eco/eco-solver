import { INestApplication } from '@nestjs/common';

import { IntentsService } from '@/modules/intents/intents.service';

import { createTestAppWithServer, waitForApp } from '../helpers/test-app.helper';

/**
 * E2E Test Context
 *
 * Contains all services and dependencies needed by E2E tests.
 * Replaces global state pattern with explicit dependency injection.
 *
 * Usage:
 *   let ctx: E2ETestContext;
 *
 *   beforeAll(async () => {
 *     ctx = await setupTestContext();
 *   });
 *
 *   it('test case', async () => {
 *     await waitForFulfillment(intentHash, ctx);
 *   });
 */
export interface E2ETestContext {
  /**
   * The NestJS application instance (shared across all test files)
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
}

/**
 * Setup E2E Test Context
 *
 * Initializes the shared NestJS application and retrieves all necessary services.
 * Call this in your test file's beforeAll() hook.
 *
 * @returns Fully initialized test context
 */
export async function setupTestContext(): Promise<E2ETestContext> {
  // Get the shared app instance (created once, reused by all test files)
  const { app, baseUrl } = await createTestAppWithServer();

  // Wait for app to be ready
  await waitForApp(baseUrl);

  // Get services from the app
  const intentsService = app.get(IntentsService);

  // Return context with all dependencies
  return {
    app,
    baseUrl,
    intentsService,
  };
}
