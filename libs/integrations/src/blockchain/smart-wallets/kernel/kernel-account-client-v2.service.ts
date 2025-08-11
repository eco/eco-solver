import {   Account,
  Chain,
  Client,
  Hex,
  LocalAccount,
  OneOf,
  Transport,
  WalletClient,
  zeroAddress,
} from 'viem'
import {   createKernelAccountClientV2,
  KernelAccountClientV2Config,
} from '@lib/transaction/smart-wallets/kernel/create-kernel-client-v2.account'

class KernelAccountClientV2ServiceBase<
  entryPointVersion extends '0.6' | '0.7',
  kernelVersion extends KernelVersion<entryPointVersion>,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  > = LocalAccount,
> extends ViemMultichainClientService<
  KernelAccountClient<Transport, Chain, SmartAccount, Client>,
  KernelAccountClientV2Config<entryPointVersion, kernelVersion, owner>
> {
  private logger = new Logger(KernelAccountClientV2ServiceBase.name)

  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerKmsService,
  ) {
    super(ecoConfigService)
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
    return clientKernel.account!.address
  }

  protected override async createInstanceClient(
    configs: KernelAccountClientV2Config<entryPointVersion, kernelVersion, owner>,
  ): Promise<KernelAccountClient<Transport, Chain, SmartAccount, Client>> {
    return createKernelAccountClientV2(configs)
  }

  protected override async buildChainConfig(
    chain: Chain,
  ): Promise<KernelAccountClientV2Config<entryPointVersion, kernelVersion, owner>> {
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
}

@Injectable()
export class KernelAccountClientV2Service extends KernelAccountClientV2ServiceBase<
  entryPointV_0_7,
  KernelVersion<entryPointV_0_7>
> {
  constructor(ecoConfigService: EcoConfigService, signerService: SignerKmsService) {
    super(ecoConfigService, signerService)
  }
}
