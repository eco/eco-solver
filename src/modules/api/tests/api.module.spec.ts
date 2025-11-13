import { ApiModule } from '../api.module';
import { BlockchainApiModule } from '../blockchain/blockchain.module';
import { QuotesModule } from '../quotes/quotes.module';

describe('ApiModule - Module Structure', () => {
  describe('module metadata', () => {
    it('should be a properly decorated NestJS module', () => {
      // Verify the module exists and is a class
      expect(ApiModule).toBeDefined();
      expect(typeof ApiModule).toBe('function');
    });

    it('should implement OnModuleInit for lifecycle hooks', () => {
      const instance = new ApiModule();
      expect(instance.onModuleInit).toBeDefined();
      expect(typeof instance.onModuleInit).toBe('function');
    });
  });

  describe('module imports', () => {
    it('should import QuotesModule statically', () => {
      // The module decorator includes QuotesModule in imports
      // Conditional access is handled by QuotesEnabledGuard
      const metadata = Reflect.getMetadata('imports', ApiModule);
      expect(metadata).toBeDefined();
      expect(Array.isArray(metadata)).toBe(true);
    });
  });

  describe('quotes enablement behavior', () => {
    it('should always import QuotesModule (enablement handled by guard)', () => {
      // QuotesModule is always imported in the @Module decorator
      // The QuotesEnabledGuard handles conditional access at runtime
      const metadata = Reflect.getMetadata('imports', ApiModule);
      expect(metadata).toContain(QuotesModule);
      expect(metadata).toContain(BlockchainApiModule);
    });
  });
});

// Note: Integration tests for actual endpoint behavior (404 when disabled, etc.)
// should be in a separate integration test file with full app bootstrap
