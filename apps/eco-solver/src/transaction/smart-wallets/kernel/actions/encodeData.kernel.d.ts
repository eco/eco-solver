import { KernelVersion } from 'permissionless/accounts';
import { type Address } from 'viem';
import { type Hex } from 'viem';
export declare const encodeKernelExecuteCallData: ({ kernelVersion, calls, }: {
    calls: readonly {
        to: Address;
        value?: bigint | undefined;
        data?: Hex | undefined;
    }[];
    kernelVersion: KernelVersion<"0.6" | "0.7">;
}) => `0x${string}`;
