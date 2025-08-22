import { Abstract, INestApplication } from '@nestjs/common/interfaces';
import { DeepMocked } from '@golevelup/ts-jest';
import { Provider } from '@nestjs/common';
import { EcoTesterHttp } from './eco-tester-http';
import { Queue } from 'bullmq';
import { TestingModule } from '@nestjs/testing';
import { Type } from '@nestjs/common/interfaces/type.interface';
export type EcoTesterTuple = [...any[]];
export declare class EcoTester {
    testModule: TestingModule;
    http: EcoTesterHttp;
    private objectsToTest;
    private config?;
    private controllers;
    private providers;
    private mocks;
    private imports;
    private queuesToMock;
    providersToOverride: Array<[Provider | string, any]>;
    private userID;
    set mockAuthedUserID(userID: string);
    private nestApp;
    get app(): INestApplication;
    private constructor();
    get objectsUnderTest(): EcoTesterTuple;
    get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol): TResult;
    mockOfQueue(queueName: string): DeepMocked<Queue>;
    mockOf<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol): DeepMocked<TResult>;
    static setupTestFor(objectsToTest: any | EcoTesterTuple, refTuple?: EcoTesterTuple): EcoTester;
    static setupTestForModule(module: any): EcoTester;
    static setupTest(): EcoTester;
    withProviders(providersToTest: Provider[] | Provider): EcoTester;
    overridingProvider(provider: Provider | string): EcoTesterWith;
    overridingProvidersWithMocks(...providers: any): EcoTester;
    withMocks(providersToMock: any[] | any): EcoTester;
    customMockFor(provider: any): EcoTesterWith;
    withModules(imports: any | any[]): EcoTester;
    withQueues(queuesToMock: string | string[]): EcoTester;
    withSchemas(schemasToMock: [string, any] | Array<[string, any]>): EcoTester;
    withMockedAuthForUser(userID: string): EcoTester;
    withConfig(config: any): EcoTester;
    withDefaultConfig(): EcoTester;
    private initInternal;
    init<T>(obj?: EcoTesterTuple): Promise<T>;
    initMany(objs?: EcoTesterTuple): Promise<EcoTesterTuple>;
    initApp(): Promise<INestApplication>;
    EcoTesterOverrideWith: {
        new (provider: Provider | string): {
            provider: Provider | string;
            with(value: any): EcoTester;
            withMock(): EcoTester;
        };
    };
    EcoTesterCustomImplementation: {
        new (provider: Provider): {
            provider: Provider;
            with(mock: any): EcoTester;
            withMock(): EcoTester;
        };
    };
}
export interface EcoTesterWith {
    with(value: any): EcoTester;
    withMock(): EcoTester;
}
