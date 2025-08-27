import { ModuleRefProvider } from '@/common/services/module-ref-provider'

export function AutoInject<T>(token: new (...args: any[]) => T) {
  return function (target: any, propertyKey: string) {
    Object.defineProperty(target, propertyKey, {
      get: function (this: any): T {
        // Create a hidden cache object per instance
        if (!this.__autoInjected) {
          Object.defineProperty(this, '__autoInjected', {
            value: {},
            writable: true,
            enumerable: false,
            configurable: true,
          })
        }

        if (!(propertyKey in this.__autoInjected)) {
          const moduleRef = ModuleRefProvider.getModuleRef()
          this.__autoInjected[propertyKey] = moduleRef.get(token, { strict: false })
        }

        return this.__autoInjected[propertyKey]
      },
      enumerable: true,
      configurable: true,
    })
  }
}
