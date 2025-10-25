import { createPublicClient, http } from 'viem';

/**
 * Wait for a service to be available by polling a URL
 */
export async function waitForHttp(
  url: string,
  options: {
    timeout?: number; // Timeout in milliseconds (default: 60000)
    interval?: number; // Polling interval in milliseconds (default: 1000)
    name?: string; // Service name for logging
  } = {},
): Promise<void> {
  const { timeout = 60000, interval = 1000, name = url } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return; // Service is available
      }
    } catch (error) {
      // Service not yet available, continue polling
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for ${name} to be available at ${url}`);
}

/**
 * Wait for MongoDB to be available
 */
export async function waitForMongo(
  uri: string,
  options: {
    timeout?: number;
    interval?: number;
    name?: string;
  } = {},
): Promise<void> {
  const { timeout = 90000, interval = 2000 } = options; // Increased defaults
  const startTime = Date.now();

  // Dynamic import to avoid loading mongodb in all tests
  const { MongoClient } = await import('mongodb');

  while (Date.now() - startTime < timeout) {
    let client: any;
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000,
        maxPoolSize: 1,
        minPoolSize: 0,
      });
      await client.connect();
      // Try a simple operation to ensure DB is truly ready
      await client.db('test').command({ ping: 1 });
      await client.close();
      return; // MongoDB is available
    } catch (error) {
      // MongoDB not yet available, continue polling
      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore close errors
        }
      }
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for MongoDB to be available at ${uri}`);
}

/**
 * Wait for Redis to be available
 */
export async function waitForRedis(
  host: string,
  port: number,
  options: {
    timeout?: number;
    interval?: number;
    name?: string;
  } = {},
): Promise<void> {
  const { timeout = 60000, interval = 1000 } = options;
  const startTime = Date.now();

  // Dynamic import to avoid loading ioredis in all tests
  const Redis = (await import('ioredis')).default;

  while (Date.now() - startTime < timeout) {
    let client: any;
    try {
      client = new Redis({
        host,
        port,
        lazyConnect: true,
        connectTimeout: 2000,
        retryStrategy: () => null, // Don't retry
      });
      await client.connect();
      await client.ping();
      client.disconnect();
      return; // Redis is available
    } catch (error) {
      // Redis not yet available, continue polling
      if (client) {
        try {
          client.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for Redis to be available at ${host}:${port}`);
}

/**
 * Wait for an Anvil RPC endpoint to be available
 */
export async function waitForAnvil(
  rpcUrl: string,
  options: {
    timeout?: number;
    interval?: number;
    name?: string;
  } = {},
): Promise<void> {
  const { timeout = 60000, interval = 1000, name = rpcUrl } = options;
  const startTime = Date.now();

  // Create a Viem client for testing the RPC
  const client = createPublicClient({
    transport: http(rpcUrl, {
      timeout: 2000,
      retryCount: 0,
    }),
  });

  while (Date.now() - startTime < timeout) {
    try {
      // Try to get the chain ID as a simple health check
      await client.getChainId();
      return; // Anvil is available
    } catch (error) {
      // Anvil not yet available, continue polling
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for Anvil to be available at ${name} (${rpcUrl})`);
}

/**
 * Wait for all services to be ready
 */
export async function waitForAllServices(config: {
  mongoUri: string;
  redisHost: string;
  redisPort: number;
  anvilInstances: Array<{ name: string; url: string }>;
  appUrl?: string; // Optional: NestJS app URL
  skipDbChecks?: boolean; // Skip MongoDB/Redis checks (trust container health checks)
}): Promise<void> {
  console.log('⏳ Waiting for all services to be ready...');

  const checks = [];

  // Only check DB services if not skipped
  if (!config.skipDbChecks) {
    checks.push(
      waitForMongo(config.mongoUri, { name: 'MongoDB' }).then(() => {
        console.log('  ✓ MongoDB ready');
      }),
      waitForRedis(config.redisHost, config.redisPort).then(() => {
        console.log('  ✓ Redis ready');
      }),
    );
  } else {
    console.log('  ✓ MongoDB ready (verified by container health check)');
    console.log('  ✓ Redis ready (verified by container health check)');
  }

  // Always check Anvil instances
  checks.push(
    ...config.anvilInstances.map((instance) =>
      waitForAnvil(instance.url, { name: instance.name }).then(() => {
        console.log(`  ✓ ${instance.name} ready`);
      }),
    ),
  );

  // Add app health check if URL provided
  if (config.appUrl) {
    checks.push(
      waitForHttp(`${config.appUrl}/health/live`, { name: 'NestJS App' }).then(() => {
        console.log('  ✓ NestJS App ready');
      }),
    );
  }

  await Promise.all(checks);

  console.log('✅ All services ready');
}
