import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';

/**
 * Shared App Manager - Singleton Pattern for E2E Tests
 *
 * This manager ensures that only ONE NestJS application instance is created
 * across all E2E test files. This prevents port conflicts and speeds up test execution.
 *
 * Key Features:
 * - Single app instance shared across all test files
 * - Automatic initialization on first access
 * - Proper cleanup on process exit
 * - Tests can directly inject services from the app
 *
 * Usage in test files:
 *   beforeAll(async () => {
 *     const { app, baseUrl } = await SharedAppManager.getApp();
 *     // Use app to get services, use baseUrl for HTTP requests
 *   });
 *
 * Note: Do NOT call app.close() in individual test files - the manager handles cleanup.
 */
class SharedAppManager {
  private static app: INestApplication | null = null;
  private static baseUrl: string | null = null;
  private static initPromise: Promise<void> | null = null;
  private static isInitialized = false;

  /**
   * Get the shared app instance, creating it if necessary
   */
  static async getApp(): Promise<{ app: INestApplication; baseUrl: string }> {
    // If already initialized, return immediately
    if (this.isInitialized && this.app && this.baseUrl) {
      return { app: this.app, baseUrl: this.baseUrl };
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return { app: this.app!, baseUrl: this.baseUrl! };
    }

    // Start initialization
    this.initPromise = this.initialize();
    await this.initPromise;

    return { app: this.app!, baseUrl: this.baseUrl! };
  }

  /**
   * Initialize the application
   */
  private static async initialize(): Promise<void> {
    console.log('\n🚀 Creating shared NestJS app instance for E2E tests...');

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

    // Start listening (catch EADDRINUSE in case port is already bound)
    try {
      await app.listen(port);
    } catch (error: any) {
      await app.close();
      this.initPromise = null;
      throw error;
    }

    this.app = app;
    this.baseUrl = `http://localhost:${port}`;
    this.isInitialized = true;

    console.log(`✅ Shared app ready at ${this.baseUrl}`);

    // Register cleanup handler
    this.registerCleanupHandler();
  }

  /**
   * Register cleanup handler to close app on process exit
   */
  private static registerCleanupHandler(): void {
    // Handle different exit scenarios
    const cleanup = async () => {
      if (this.app && this.isInitialized) {
        console.log('\n🛑 Closing shared app instance...');
        try {
          await this.app.close();
          console.log('✅ App closed successfully');
        } catch (error) {
          console.error('❌ Error closing app:', error);
        }
        this.app = null;
        this.baseUrl = null;
        this.isInitialized = false;
      }
    };

    // Register cleanup on various exit signals
    process.on('beforeExit', cleanup);
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });
  }
}

export { SharedAppManager };
