import { Logger } from '@nestjs/common';
import { ViemMultichainClientService } from '../../viem_multichain_client.service';
import { EcoConfigService } from '@libs/solver-config';
import { Account, Chain, Hex, LocalAccount, OneOf, Transport, WalletClient } from 'viem';
import { KernelAccountClientConfig } from './kernel-account.config';
import { KernelVersion } from 'permissionless/accounts';
import { entryPointV_0_7 } from './create.kernel.account';
import { KernelAccountClient } from './kernel-account.client';
import { EthereumProvider } from 'permissionless/utils/toOwner';
import { SignerKmsService } from '@eco-solver/sign/signer-kms.service';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { EstimatedGasData } from '@eco-solver/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface';
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
export declare class KernelAccountClientServiceBase<entryPointVersion extends '0.6' | '0.7', kernelVersion extends KernelVersion<entryPointVersion>, owner extends OneOf<EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount>> extends ViemMultichainClientService<KernelAccountClient<entryPointVersion>, KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>> {
    readonly ecoConfigService: EcoConfigService;
    private readonly signerService;
    protected logger: Logger;
    constructor(ecoConfigService: EcoConfigService, signerService: SignerKmsService);
    protected createInstanceClient(configs: KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>): Promise<KernelAccountClient<entryPointVersion>>;
    protected buildChainConfig(chain: Chain): Promise<KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>>;
    /**
     * Returns the address of the wallet for the first solver in the config.
     * @returns
     */
    getAddress(): Promise<Hex>;
}
export declare class KernelAccountClientService extends KernelAccountClientServiceBase<entryPointV_0_7, KernelVersion<entryPointV_0_7>, LocalAccount> {
    constructor(ecoConfigService: EcoConfigService, signerService: SignerKmsService);
    estimateGasForKernelExecution(chainID: number, transactions: ExecuteSmartWalletArg[]): Promise<EcoResponse<EstimatedGasData>>;
}
