import { AnotherSimpleClass } from './another-simple-class';
import { ClassWithConfig } from './class-with-config';
import { ClassWithDependency } from './class-with-dependency';
import { SimpleClass } from './simple-class';
import { TestDBModel } from './test-db-model';
import * as mongoose from 'mongoose';
export declare class ClassWithAllTheThings {
    readonly simpleDependency: SimpleClass;
    readonly anotherSimpleDependency: AnotherSimpleClass;
    readonly classWithConfig: ClassWithConfig;
    readonly classWithDependency: ClassWithDependency;
    model: mongoose.Model<TestDBModel>;
    constructor(simpleDependency: SimpleClass, anotherSimpleDependency: AnotherSimpleClass, classWithConfig: ClassWithConfig, classWithDependency: ClassWithDependency, model: mongoose.Model<TestDBModel>);
    doThing(param1: string): string;
    gimmeConfig(): any;
}
