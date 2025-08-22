import { EcoConfigService } from '@libs/solver-config';
import { ViemMultichainClientService } from '../../viem_multichain_client.service';
import { SimpleAccountClient, SimpleAccountClientConfig } from '.';
import { SignerService } from '../../../sign/signer.service';
import { Chain } from 'viem';
export declare class SimpleAccountClientService extends ViemMultichainClientService<SimpleAccountClient, SimpleAccountClientConfig> {
    readonly ecoConfigService: EcoConfigService;
    private readonly signerService;
    constructor(ecoConfigService: EcoConfigService, signerService: SignerService);
    protected createInstanceClient(configs: SimpleAccountClientConfig): Promise<SimpleAccountClient>;
    protected buildChainConfig(chain: Chain): Promise<SimpleAccountClientConfig>;
}
