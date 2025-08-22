import { OnModuleInit } from '@nestjs/common';
import { Chain, Client, ClientConfig, Hex } from 'viem';
import { EcoConfigService } from '@libs/solver-config';
export declare class ViemMultichainClientService<T extends Client, V extends ClientConfig> implements OnModuleInit {
    readonly ecoConfigService: EcoConfigService;
    readonly instances: Map<number, T>;
    protected supportedAlchemyChainIds: number[];
    protected pollingInterval: number;
    constructor(ecoConfigService: EcoConfigService);
    onModuleInit(): void;
    getClient(id: number): Promise<T>;
    /**
     * Use overrides if they exist -- otherwise use the default settings.
     * @param chainID
     * @returns
     */
    getChainConfig(chainID: number): Promise<V>;
    protected createInstanceClient(configs: V): Promise<T>;
    protected buildChainConfig(chain: Chain): Promise<V>;
    /**
     * Returns the address of the wallet for the first solver in the config.
     * @returns
     */
    protected getAddress(): Promise<Hex>;
    private setChainConfigs;
    private loadInstance;
    private isSupportedNetwork;
}
