import { AdaptedWallet } from '@reservoir0x/relay-sdk';
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient';
/**
 * Adapts a KernelAccountClient wallet to the Relay SDK's AdaptedWallet interface
 *
 * @param _kernelClient The KernelAccountClient instance to adapt
 * @param switchChainFn Optional function to handle chain switching
 * @returns An AdaptedWallet compatible with Relay SDK
 */
export declare const adaptKernelWallet: (_kernelClient: KernelAccountClient, switchChainFn: (chainId: number) => Promise<KernelAccountClient>) => AdaptedWallet;
