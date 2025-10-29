import { ModuleRef } from '@nestjs/core';

/**
 * ModuleRefProvider - Global Service Locator Pattern
 *
 * ⚠️ WARNING: This is a service locator pattern and should be used sparingly.
 *
 * Purpose: Breaks circular dependencies between ConfigurationModule and
 * EcoConfigModule that cannot be resolved through standard dependency injection.
 *
 * Risks:
 * - Hides dependencies, making code harder to understand and test
 * - Bypasses type safety at compile time
 * - Can lead to runtime errors if ModuleRef isn't initialized
 *
 * Usage Guidelines:
 * - Only use when standard DI and forwardRef() cannot solve the problem
 * - Always document why standard DI cannot be used
 * - Consider refactoring to eliminate the need for this pattern
 *
 * @internal This should not be used outside of the configuration/migration system
 */
export class ModuleRefProvider {
  private static _moduleRef: ModuleRef;

  static setModuleRef = (moduleRef: ModuleRef) => {
    this._moduleRef = moduleRef;
  };

  static getModuleRef = (): ModuleRef => {
    if (!this._moduleRef) {
      throw new Error('ModuleRef not initialized yet');
    }

    return this._moduleRef;
  };

  static getService<T>(token: new (...args: any[]) => T): T {
    return this.getModuleRef().get(token, { strict: false });
  }
}
