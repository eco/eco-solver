import { DynamicModule, Provider } from '@nestjs/common';
export declare function provideEcoConfigService(ecoConfig: any): Provider;
export declare function provideEcoConfigServiceWithStatic(ecoConfig: any): Provider;
export declare function provideAndMock(type: any, options?: any): Provider;
export declare function mongooseWithSchemas(schemas: Array<[string, any]>): DynamicModule[];
