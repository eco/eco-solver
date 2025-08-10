import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, KernelV3AccountAbi } from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  Address,
  Chain,
  ChainFormatters,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  Hash,
  keccak256,
  LocalAccount,
  Transport,
  WalletClient,
} from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import { Call, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';
import { sum } from '@/common/utils/math';
import { minutes, now } from '@/common/utils/time';
import { EvmNetworkConfig, KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { ecdsaExecutorAbi } from '@/modules/blockchain/evm/wallets/kernel-wallet/constants/ecdsa-executor.abi';
import {
  encodeKernelExecuteCallData,
  encodeKernelExecuteParams,
} from '@/modules/blockchain/evm/wallets/kernel-wallet/utils/encode-transactions';

const kernelVersion = KERNEL_V3_1;
const entryPoint = getEntryPoint('0.7');

type KernelAccount = Awaited<ReturnType<typeof createKernelAccount>>;

export class KernelWallet extends BaseEvmWallet {
  private kernelAccount!: KernelAccount;
  private readonly ecdsaExecutorAddr?: Address;
  private readonly publicClient: ReturnType<EvmTransportService['getPublicClient']>;
  private readonly signerWalletClient: WalletClient<Transport, Chain<ChainFormatters>>;

  private initialized = false;
  private executorEnabled = false;

  constructor(
    private readonly chainId: number,
    private readonly signer: LocalAccount,
    private readonly kernelWalletConfig: KernelWalletConfig,
    private readonly networkConfig: EvmNetworkConfig,
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

    this.ecdsaExecutorAddr = this.networkConfig.contracts?.ecdsaExecutor as Address;
    this.signerWalletClient = signerWalletClient;
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

    // Install ECDSA Executor module if configured
    await this.installEcdsaExecutorModule();

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

  async writeContracts(calls: Call[], options?: WriteContractsOptions): Promise<Hash[]> {
    return this.executorEnabled
      ? this.writeWithExecutor(calls, options)
      : this.writeWithSigner(calls, options);
  }

  async writeWithSigner(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));

    // Send transaction using the signer wallet client
    const hash = await this.signerWalletClient.sendTransaction({
      to: this.kernelAccount.address,
      data: encodeKernelExecuteCallData(calls),
      value: totalValue,
    } as any);

    return [hash];
  }

  async writeWithExecutor(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));

    const execution = encodeKernelExecuteParams(calls);

    const nonceKey = 0n;
    const nonce = await this.publicClient.readContract({
      address: this.ecdsaExecutorAddr,
      abi: ecdsaExecutorAbi,
      functionName: 'getNonce',
      args: [this.kernelAccount.address, nonceKey],
    });

    const expiration = BigInt(now() + minutes(5));

    const executionHash = keccak256(
      encodeAbiParameters(
        [
          { type: 'address' },
          { type: 'bytes32' },
          { type: 'bytes' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
        ],
        [
          this.kernelAccount.address,
          execution.mode,
          execution.callData,
          nonce,
          expiration,
          BigInt(this.chainId),
        ],
      ),
    );

    const signature = await this.signerWalletClient.signMessage({
      message: { raw: executionHash },
    } as any);

    // Send transaction using the signer wallet client
    const hash = await this.signerWalletClient.writeContract({
      address: this.ecdsaExecutorAddr,
      abi: ecdsaExecutorAbi,
      functionName: 'execute',
      value: totalValue,
      args: [
        this.kernelAccount.address,
        execution.mode,
        execution.callData,
        nonce,
        expiration,
        signature,
      ],
    } as any);

    return [hash];
  }

  private async installEcdsaExecutorModule(): Promise<void> {
    if (!this.ecdsaExecutorAddr) {
      // Skip installation if ECDSA executor address is not configured
      return;
    }

    // Module type 2 = executor in ERC-7579
    const moduleType = 2;

    // Check if the module is already installed
    const isInstalled = await this.isModuleInstalled(moduleType, this.ecdsaExecutorAddr);
    if (isInstalled) {
      return;
    }

    // Encode the signer address as the owner for the ECDSA executor module
    const initData = encodeAbiParameters([{ type: 'address' }], [this.signer.address]);

    // Install the module
    await this.installModule(moduleType, this.ecdsaExecutorAddr, initData);

    this.executorEnabled = true;
  }

  private async isModuleInstalled(moduleType: number, moduleAddress: Address): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.kernelAccount.address,
        abi: KernelV3AccountAbi,
        functionName: 'isModuleInstalled',
        args: [BigInt(moduleType), moduleAddress, '0x'],
      });
      return result as boolean;
    } catch {
      // If the call fails, assume module is not installed
      return false;
    }
  }

  private async installModule(
    moduleType: number,
    moduleAddress: Address,
    initData: Hash,
  ): Promise<void> {
    const installData = encodeFunctionData({
      abi: KernelV3AccountAbi,
      functionName: 'installModule',
      args: [BigInt(moduleType), moduleAddress, initData],
    });

    // Execute the module installation
    const hash = await this.signerWalletClient.sendTransaction({
      to: this.kernelAccount.address,
      data: installData,
    } as any);

    // Wait for transaction confirmation
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
}
