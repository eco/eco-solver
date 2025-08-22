import { CommandRunner } from 'nest-commander';
export declare class SafeCommand extends CommandRunner {
    constructor();
    run(passedParams: string[], options?: Record<string, any>): Promise<void>;
    parseKernelAddress(val: string): `0x${string}`;
    parseTo(val: string): `0x${string}`;
    parseAmount(val: string): bigint;
    parseToken(val: string): `0x${string}`;
}
