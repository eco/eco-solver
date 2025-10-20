import { ModuleRef } from '@nestjs/core';

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
