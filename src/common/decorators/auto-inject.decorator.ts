import { ModuleRefProvider } from '@/common/services/module-ref-provider'

export function AutoInject<T>(token: new (...args: any[]) => T) {
  return function (target: any, propertyKey: string) {
    let instance: T

    Object.defineProperty(target, propertyKey, {
      get: function () {
        if (!instance) {
          const moduleRef = ModuleRefProvider.getModuleRef()
          instance = moduleRef.get(token, { strict: false })
        }
        return instance
      },
      enumerable: true,
      configurable: true,
    })
  }
}
