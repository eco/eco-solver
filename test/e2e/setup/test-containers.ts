import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

/**
 * Container configuration for E2E tests
 */
export interface ContainerConfig {
  mongoUri: string;
  redisHost: string;
  redisPort: number;
}

/**
 * Manages Docker containers for E2E testing using Testcontainers
 *
 * Automatically detects CI environment and skips container startup when
 * services are provided by GitHub Actions.
 *
 * Usage:
 *   const manager = new TestContainersManager();
 *   const config = await manager.start();
 *   // ... use config.mongoUri and redis connection ...
 *   await manager.stop();
 */
export class TestContainersManager {
  private mongoContainer?: StartedMongoDBContainer;
  private redisContainer?: StartedRedisContainer;
  private isCI: boolean;

  constructor() {
    // Detect CI environment
    this.isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  }

  /**
   * Start all containers (or use CI services)
   */
  async start(): Promise<ContainerConfig> {
    if (this.isCI) {
      console.log('🔵 CI environment detected - using GitHub Actions services');
      return this.getCIConfig();
    }

    console.log('🐳 Starting Docker containers with Testcontainers...');

    // Start MongoDB and Redis in parallel
    const [mongoContainer, redisContainer] = await Promise.all([
      this.startMongo(),
      this.startRedis(),
    ]);

    this.mongoContainer = mongoContainer;
    this.redisContainer = redisContainer;

    const config: ContainerConfig = {
      mongoUri: this.mongoContainer.getConnectionString(),
      redisHost: this.redisContainer.getHost(),
      redisPort: this.redisContainer.getMappedPort(6379),
    };

    console.log('✅ All containers started successfully');
    console.log(`  MongoDB: ${config.mongoUri}`);
    console.log(`  Redis: ${config.redisHost}:${config.redisPort}`);

    return config;
  }

  /**
   * Start MongoDB container
   */
  private async startMongo(): Promise<StartedMongoDBContainer> {
    console.log('  Starting MongoDB...');

    const container = await new MongoDBContainer('mongo:7').start();

    console.log(`    ✓ MongoDB ready on ${container.getHost()}:${container.getMappedPort(27017)}`);

    return container;
  }

  /**
   * Start Redis container
   */
  private async startRedis(): Promise<StartedRedisContainer> {
    console.log('  Starting Redis...');

    const container = await new RedisContainer('redis:8-alpine').start();

    console.log(`    ✓ Redis ready on ${container.getHost()}:${container.getMappedPort(6379)}`);

    return container;
  }

  /**
   * Get configuration for CI environment
   * Assumes GitHub Actions services are available
   */
  private getCIConfig(): ContainerConfig {
    return {
      // GitHub Actions services use service name as hostname
      mongoUri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/intent-solver-e2e',
      redisHost: process.env.REDIS_HOST || 'redis',
      redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
  }

  /**
   * Stop all containers
   */
  async stop(): Promise<void> {
    if (this.isCI) {
      console.log('🔵 CI environment - skipping container cleanup (handled by GitHub Actions)');
      return;
    }

    console.log('🛑 Stopping Docker containers...');

    const stopPromises: Promise<void>[] = [];

    if (this.mongoContainer) {
      console.log('  Stopping MongoDB...');
      stopPromises.push(
        this.mongoContainer.stop().then(() => {
          console.log('    ✓ MongoDB stopped');
        }),
      );
    }

    if (this.redisContainer) {
      console.log('  Stopping Redis...');
      stopPromises.push(
        this.redisContainer.stop().then(() => {
          console.log('    ✓ Redis stopped');
        }),
      );
    }

    await Promise.all(stopPromises);

    console.log('✅ All containers stopped');
  }

  /**
   * Check if running in CI environment
   */
  isRunningInCI(): boolean {
    return this.isCI;
  }
}
