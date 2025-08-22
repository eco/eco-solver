import { ViemMultichainClientService } from '../../viem_multichain_client.service';
import { SmartAccount } from 'viem/account-abstraction';
import { EcoConfigService } from '@libs/solver-config';
import { Account, Chain, Client, Hex, LocalAccount, OneOf, Transport, WalletClient } from 'viem';
import { KernelVersion } from 'permissionless/accounts';
import { entryPointV_0_7 } from './create.kernel.account';
import { KernelAccountClientV2Config } from '@eco-solver/transaction/smart-wallets/kernel/create-kernel-client-v2.account';
import { EthereumProvider } from 'permissionless/utils/toOwner';
import { SignerKmsService } from '@eco-solver/sign/signer-kms.service';
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient';
declare class KernelAccountClientV2ServiceBase<entryPointVersion extends '0.6' | '0.7', kernelVersion extends KernelVersion<entryPointVersion>, owner extends OneOf<EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount> = LocalAccount> extends ViemMultichainClientService<KernelAccountClient<Transport, Chain, SmartAccount, Client>, KernelAccountClientV2Config<entryPointVersion, kernelVersion, owner>> {
    readonly ecoConfigService: EcoConfigService;
    private readonly signerService;
    private logger;
    constructor(ecoConfigService: EcoConfigService, signerService: SignerKmsService);
    /**
     * Returns the address of the wallet for the first solver in the config.
     * @returns
     */
    getAddress(): Promise<Hex>;
    protected createInstanceClient(configs: KernelAccountClientV2Config<entryPointVersion, kernelVersion, owner>): Promise<KernelAccountClient<Transport, Chain, SmartAccount, Client>>;
    protected buildChainConfig(chain: Chain): Promise<KernelAccountClientV2Config<entryPointVersion, kernelVersion, owner>>;
}
export declare class KernelAccountClientV2Service extends KernelAccountClientV2ServiceBase<entryPointV_0_7, KernelVersion<entryPointV_0_7>> {
    constructor(ecoConfigService: EcoConfigService, signerService: SignerKmsService);
}
export {};
