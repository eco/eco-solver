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
import { SystemLoggerService } from '@/modules/logging/logger.service';
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
    private readonly logger: SystemLoggerService,
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
    this.logger.setContext(KernelWallet.name);
  }

  async init() {
    if (this.initialized) {
      this.logger.debug('Kernel wallet already initialized');
      return;
    }

    this.logger.log('Initializing kernel wallet', {
      chainId: this.chainId,
      signerAddress: this.signer.address,
    });

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

    this.logger.log('Kernel account created', {
      accountAddress: this.kernelAccount.address,
    });

    const isDeployed = await this.kernelAccount.isDeployed();
    if (!isDeployed) {
      this.logger.log('Kernel account not deployed, deploying now...');
      await this.deploy(this.kernelAccount);
    } else {
      this.logger.log('Kernel account already deployed', {
        accountAddress: this.kernelAccount.address,
      });
    }

    // Install ECDSA Executor module if configured
    await this.installEcdsaExecutorModule();

    this.initialized = true;
    this.logger.log('Kernel wallet initialization complete', {
      executorEnabled: this.executorEnabled,
    });
  }

  async deploy(kernelAccount: KernelAccount) {
    const { factory, factoryData } = await kernelAccount.getFactoryArgs();

    if (!factoryData || !factory) {
      const error = 'Unable to deploy kernel account: factory or factoryData is missing';
      this.logger.error(error);
      throw new Error(error);
    }

    this.logger.log('Deploying kernel account', {
      accountAddress: kernelAccount.address,
      factory,
    });

    const hash = await this.signerWalletClient.sendTransaction({
      to: factory,
      data: factoryData,
    } as any);

    this.logger.log('Deployment transaction sent', { transactionHash: hash });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      this.logger.log('Kernel account deployed successfully', {
        transactionHash: hash,
        gasUsed: receipt.gasUsed?.toString(),
      });
    } else {
      const error = `Kernel account deployment failed`;
      this.logger.error(error, undefined, { transactionHash: hash });
      throw new Error(`${error}. Transaction hash: ${hash}`);
    }
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
    const mode = this.executorEnabled ? 'executor' : 'signer';
    this.logger.debug('Executing writeContracts', {
      mode,
      callsCount: calls.length,
      totalValue: options?.value?.toString(),
    });

    return this.executorEnabled
      ? this.writeWithExecutor(calls, options)
      : this.writeWithSigner(calls, options);
  }

  async writeWithSigner(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));

    this.logger.debug('Executing transaction with signer mode', {
      accountAddress: this.kernelAccount.address,
      totalValue: totalValue.toString(),
    });

    // Send transaction using the signer wallet client
    const hash = await this.signerWalletClient.sendTransaction({
      to: this.kernelAccount.address,
      data: encodeKernelExecuteCallData(calls),
      value: totalValue,
    } as any);

    this.logger.log('Transaction sent via signer', { transactionHash: hash });

    return [hash];
  }

  async writeWithExecutor(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));

    this.logger.debug('Executing transaction with executor mode', {
      executorAddress: this.ecdsaExecutorAddr,
      totalValue: totalValue.toString(),
    });

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

    this.logger.log('Transaction sent via executor', {
      transactionHash: hash,
      nonce: nonce.toString(),
      expiration: expiration.toString(),
    });

    return [hash];
  }

  private async installEcdsaExecutorModule(): Promise<void> {
    if (!this.ecdsaExecutorAddr) {
      this.logger.debug('ECDSA executor module installation skipped: no executor address configured');
      return;
    }

    this.logger.log('Checking ECDSA executor module installation', {
      executorAddress: this.ecdsaExecutorAddr,
    });

    // Module type 2 = executor in ERC-7579
    const moduleType = 2;

    // Check if the module is already installed
    const isInstalled = await this.isModuleInstalled(moduleType, this.ecdsaExecutorAddr);
    if (isInstalled) {
      this.logger.log('ECDSA executor module already installed');
      this.executorEnabled = true;
      return;
    }

    this.logger.log('Installing ECDSA executor module', {
      moduleType,
      moduleAddress: this.ecdsaExecutorAddr,
      owner: this.signer.address,
    });

    // Encode the signer address as the owner for the ECDSA executor module
    const initData = encodeAbiParameters([{ type: 'address' }], [this.signer.address]);

    // Install the module
    await this.installModule(moduleType, this.ecdsaExecutorAddr, initData);

    this.executorEnabled = true;
    this.logger.log('ECDSA executor module installed successfully');
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

    this.logger.log('Module installation transaction sent', { transactionHash: hash });

    // Wait for transaction confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      this.logger.log('Module installed successfully', {
        transactionHash: hash,
        gasUsed: receipt.gasUsed?.toString(),
      });
    } else {
      const error = `Module installation failed`;
      this.logger.error(error, undefined, {
        transactionHash: hash,
        moduleType,
        moduleAddress,
      });
      throw new Error(`${error}. Transaction hash: ${hash}`);
    }
  }
}
