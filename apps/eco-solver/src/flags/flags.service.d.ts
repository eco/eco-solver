import { OnModuleInit } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service';
export type LaunchDarklyFlags = {
    bendWalletOnly: boolean;
};
export type FlagType = keyof LaunchDarklyFlags;
export declare const FlagVariationKeys: Record<FlagType, string>;
/**
 * Service class for interacting with the Launch Darkly feature flagging service
 */
export declare class FlagService implements OnModuleInit {
    private readonly kernelAccountService;
    private readonly ecoConfigService;
    private logger;
    private flagsClient;
    private context;
    private flagValues;
    constructor(kernelAccountService: KernelAccountClientService, ecoConfigService: EcoConfigService);
    onModuleInit(): Promise<void>;
    getFlagValue<T extends FlagType>(flag: T): LaunchDarklyFlags[T];
    static isSupportedFlag(flag: string): boolean;
    /**
     * Initializes the Launch Darkly client with the provided API key. Sets an
     * on ready listener to initialize the flags
     */
    private initLaunchDarklyClient;
    /**
     * Registers update listeners for when flags are updated. Also occures on first init
     */
    private registerFlagListeners;
}
