import { SimpleClass } from './simple-class';
export declare class ClassWithDependency {
    private readonly simpleDependency;
    constructor(simpleDependency: SimpleClass);
    doThing(param1: string): string;
}
