import { Injectable, Logger } from '@nestjs/common'
import { ViemMultichainClientService } from '../../viem_multichain_client.service'
import { entryPoint07Address } from 'viem/account-abstraction'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { SignerService } from '@/sign/signer.service'
import {
  Account,
  Chain,
  Hex,
  LocalAccount,
  OneOf,
  Transport,
  WalletClient,
  zeroAddress,
} from 'viem'
import { KernelAccountClientConfig } from './kernel-account.config'
import { KernelVersion } from 'permissionless/accounts'
import { createKernelAccountClient, entryPointV_0_7 } from './create.kernel.account'
import { KernelAccountClient } from './kernel-account.client'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EthereumProvider } from 'permissionless/utils/toOwner'

@Injectable()
export class KernelAccountClientServiceBase<
  entryPointVersion extends '0.6' | '0.7',
  kernelVersion extends KernelVersion<entryPointVersion>,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  >,
> extends ViemMultichainClientService<
  KernelAccountClient<entryPointVersion>,
  KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>
> {
  private logger = new Logger(KernelAccountClientServiceBase.name)

  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerService,
  ) {
    super(ecoConfigService)
  }

  protected override async createInstanceClient(
    configs: KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>,
  ): Promise<KernelAccountClient<entryPointVersion>> {
    const { client, args } = await createKernelAccountClient(configs)
    if (args && args.deployReceipt) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Deploying Kernel Account`,
          properties: {
            ...args,
            kernelAccount: client.kernelAccount.address,
          },
        }),
      )
    }
    return client
  }

  protected override async buildChainConfig(
    chain: Chain,
  ): Promise<KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>> {
    const base = await super.buildChainConfig(chain)
    return {
      ...base,
      account: this.signerService.getAccount(),
      useMetaFactory: false,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7' as entryPointVersion,
      },
      owners: [this.signerService.getAccount() as owner],
      index: 0n, // optional
    }
  }
  /**
   * Returns the address of the wallet for the first solver in the config.
   * @returns
   */
  public override async getAddress(): Promise<Hex> {
    const solvers = this.ecoConfigService.getSolvers()
    if (!solvers || Object.values(solvers).length == 0) {
      return zeroAddress
    }

    const clientKernel = await this.getClient(Object.values(solvers)[0].chainID)
    return clientKernel.kernelAccount?.address
  }
}

@Injectable()
export class KernelAccountClientService extends KernelAccountClientServiceBase<
  entryPointV_0_7,
  KernelVersion<entryPointV_0_7>,
  LocalAccount
> {
  constructor(ecoConfigService: EcoConfigService, signerService: SignerService) {
    super(ecoConfigService, signerService)
  }
}
