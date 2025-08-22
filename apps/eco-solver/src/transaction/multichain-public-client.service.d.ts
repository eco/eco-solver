import { PublicClient, PublicClientConfig } from 'viem';
import { ViemMultichainClientService } from './viem_multichain_client.service';
export declare class MultichainPublicClientService extends ViemMultichainClientService<PublicClient, PublicClientConfig> {
    protected createInstanceClient(configs: PublicClientConfig): Promise<PublicClient>;
}
