import { Enumify } from 'enumify';
export declare class IntentExecutionType extends Enumify {
    static SELF_PUBLISH: IntentExecutionType;
    static GASLESS: IntentExecutionType;
    static _: void;
    static fromString(enumstr: string): IntentExecutionType | undefined;
    isSelfPublish(): boolean;
    isGasless(): boolean;
    toString(): string;
}
export declare const IntentExecutionTypeKeys: readonly ["SELF_PUBLISH", "GASLESS"];
