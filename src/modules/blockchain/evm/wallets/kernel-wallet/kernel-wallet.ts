import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount } from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { Address, createWalletClient, Hash, LocalAccount, WalletClient } from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import { Call, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';
import { sum } from '@/common/utils/math';
import { KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { encodeKernelExecuteCallData } from '@/modules/blockchain/evm/wallets/kernel-wallet/utils/encode-transactions';

const kernelVersion = KERNEL_V3_1;
const entryPoint = getEntryPoint('0.7');

type KernelAccount = Awaited<ReturnType<typeof createKernelAccount>>;

export class KernelWallet extends BaseEvmWallet {
  private kernelAccount!: KernelAccount;
  private readonly publicClient: ReturnType<EvmTransportService['getPublicClient']>;
  private readonly signerWalletClient: WalletClient;

  private initialized = false;

  constructor(
    private readonly chainId: number,
    private readonly signer: LocalAccount,
    private readonly kernelWalletConfig: KernelWalletConfig,
    private readonly transportService: EvmTransportService,
  ) {
    super();

    const chain = this.transportService.getViemChain(chainId);
    const transport = this.transportService.getTransport(chainId);

    const signerWalletClient = createWalletClient({
      account: signer,
      chain,
      transport,
    });

    this.signerWalletClient = signerWalletClient as WalletClient;
    this.publicClient = this.transportService.getPublicClient(chainId);
  }

  async init() {
    if (this.initialized) return;

    // Create Kernel Wallet Client
    const ecdsaValidator = await signerToEcdsaValidator(this.publicClient as any, {
      signer: this.signer,
      entryPoint: entryPoint!,
      kernelVersion,
    });

    this.kernelAccount = await createKernelAccount(this.publicClient as any, {
      entryPoint,
      kernelVersion,
      useMetaFactory: false,
      plugins: {
        sudo: ecdsaValidator,
      },
    });

    const isDeployed = await this.kernelAccount.isDeployed();
    if (!isDeployed) {
      await this.deploy(this.kernelAccount);
    }

    this.initialized = true;
  }

  async deploy(kernelAccount: KernelAccount) {
    const { factory, factoryData } = await kernelAccount.getFactoryArgs();

    if (!factoryData || !factory) {
      throw new Error('Unable to deploy kernel account');
    }

    const hash = await this.signerWalletClient.sendTransaction({
      to: factory,
      data: factoryData,
    } as any);

    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  async getAddress(): Promise<Address> {
    return this.kernelAccount.address;
  }

  async writeContract(call: Call): Promise<Hash> {
    // Send transaction using the signer wallet client
    const [hash] = await this.writeContracts([call]);
    return hash;
  }

  async writeContracts(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));

    // Send transaction using the signer wallet client
    const hash = await this.signerWalletClient.sendTransaction({
      to: this.kernelAccount.address,
      data: encodeKernelExecuteCallData(calls),
      value: totalValue,
    } as any);

    return [hash];
  }
}
