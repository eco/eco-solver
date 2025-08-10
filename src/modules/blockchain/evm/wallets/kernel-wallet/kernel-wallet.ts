import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, KernelV3AccountAbi } from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import * as api from '@opentelemetry/api';
import {
  Address,
  Chain,
  ChainFormatters,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  Hash,
  Hex,
  isAddress,
  keccak256,
  LocalAccount,
  PublicClient,
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
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
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
  private moduleStatusCache = new Map<string, boolean>();

  constructor(
    private readonly chainId: number,
    private readonly signer: LocalAccount,
    private readonly kernelWalletConfig: KernelWalletConfig,
    private readonly networkConfig: EvmNetworkConfig,
    private readonly transportService: EvmTransportService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();

    const chain = this.transportService.getViemChain(chainId);
    const transport = this.transportService.getTransport(chainId);

    const signerWalletClient = createWalletClient({
      account: signer,
      chain,
      transport,
    });

    // Validate executor address if provided
    const executorAddr = this.networkConfig.contracts?.ecdsaExecutor;
    if (executorAddr) {
      if (!isAddress(executorAddr)) {
        throw new Error(`Invalid ECDSA executor address: ${executorAddr}`);
      }
      this.ecdsaExecutorAddr = executorAddr as Address;
    }
    
    this.signerWalletClient = signerWalletClient;
    this.publicClient = this.transportService.getPublicClient(chainId);
    this.logger.setContext(KernelWallet.name);
  }

  async init() {
    if (this.initialized) {
      this.logger.debug('Kernel wallet already initialized');
      return;
    }

    const span = this.otelService.startSpan('kernel.wallet.init', {
      attributes: {
        'kernel.chain_id': this.chainId,
        'kernel.signer_address': this.signer.address,
        'kernel.version': kernelVersion,
      },
    });

    try {
      this.logger.log('Initializing kernel wallet', {
        chainId: this.chainId,
        signerAddress: this.signer.address,
      });

      // Create Kernel Wallet Client
      let ecdsaValidator;
      try {
        // Note: Type assertion needed due to Zerodev SDK type incompatibility with viem v2
        ecdsaValidator = await signerToEcdsaValidator(this.publicClient as any, {
          signer: this.signer,
          entryPoint: entryPoint!,
          kernelVersion,
        });
      } catch (error) {
        const msg = `Failed to create ECDSA validator for kernel wallet`;
        this.logger.error(msg, error as Error);
        throw new Error(`${msg}: ${(error as Error).message}`);
      }

      try {
        // Note: Type assertion needed due to Zerodev SDK type incompatibility with viem v2
        this.kernelAccount = await createKernelAccount(this.publicClient as any, {
          entryPoint,
          kernelVersion,
          useMetaFactory: false,
          plugins: {
            sudo: ecdsaValidator,
          },
        });
      } catch (error) {
        const msg = `Failed to create kernel account`;
        this.logger.error(msg, error as Error);
        throw new Error(`${msg}: ${(error as Error).message}`);
      }

      span.setAttribute('kernel.account_address', this.kernelAccount.address);
      this.logger.log('Kernel account created', {
        accountAddress: this.kernelAccount.address,
      });

      let isDeployed: boolean;
      try {
        isDeployed = await this.kernelAccount.isDeployed();
      } catch (error) {
        const msg = `Failed to check kernel account deployment status`;
        this.logger.error(msg, error as Error);
        throw new Error(`${msg}: ${(error as Error).message}`);
      }
      
      span.setAttribute('kernel.is_deployed', isDeployed);
      
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
      span.setAttribute('kernel.executor_enabled', this.executorEnabled);
      
      this.logger.log('Kernel wallet initialization complete', {
        executorEnabled: this.executorEnabled,
      });
      
      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ 
        code: api.SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      this.logger.error('Kernel wallet initialization failed', error as Error, {
        chainId: this.chainId,
        signerAddress: this.signer.address,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  async deploy(kernelAccount: KernelAccount) {
    const span = this.otelService.startSpan('kernel.wallet.deploy', {
      attributes: {
        'kernel.account_address': kernelAccount.address,
        'kernel.chain_id': this.chainId,
      },
    });

    try {
      const { factory, factoryData } = await kernelAccount.getFactoryArgs();

      if (!factoryData || !factory) {
        const error = 'Unable to deploy kernel account: factory or factoryData is missing';
        this.logger.error(error);
        throw new Error(error);
      }

      span.setAttribute('kernel.factory_address', factory);
      this.logger.log('Deploying kernel account', {
        accountAddress: kernelAccount.address,
        factory,
      });

      const hash = await this.signerWalletClient.sendTransaction({
        to: factory,
        data: factoryData,
      } as any);

      span.setAttribute('kernel.deployment_tx_hash', hash);
      this.logger.log('Deployment transaction sent', { transactionHash: hash });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        span.setAttributes({
          'kernel.deployment_gas_used': receipt.gasUsed?.toString() ?? '0',
          'kernel.deployment_status': 'success',
        });
        
        this.logger.log('Kernel account deployed successfully', {
          transactionHash: hash,
          gasUsed: receipt.gasUsed?.toString(),
        });
        
        span.setStatus({ code: api.SpanStatusCode.OK });
      } else {
        const error = `Kernel account deployment failed`;
        this.logger.error(error, undefined, { transactionHash: hash });
        throw new Error(`${error}. Transaction hash: ${hash}`);
      }
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ 
        code: api.SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  async getAddress(): Promise<Address> {
    if (!this.initialized || !this.kernelAccount) {
      throw new Error('Kernel wallet not initialized. Call init() first.');
    }
    return this.kernelAccount.address;
  }

  /**
   * Get the current module installation status from cache
   * @param moduleType - The ERC-7579 module type
   * @param moduleAddress - The address of the module
   * @returns Cached status or undefined if not cached
   */
  getModuleStatusFromCache(moduleType: number, moduleAddress: Address): boolean | undefined {
    const cacheKey = `${moduleType}-${moduleAddress}`;
    return this.moduleStatusCache.get(cacheKey);
  }

  /**
   * Clear the module status cache
   */
  clearModuleCache(): void {
    this.moduleStatusCache.clear();
  }

  /**
   * Check if executor mode is enabled
   * @returns true if executor module is installed and enabled
   */
  isExecutorEnabled(): boolean {
    return this.executorEnabled;
  }

  async writeContract(call: Call): Promise<Hash> {
    if (!call || !call.to) {
      throw new Error('Invalid call parameters: missing required fields');
    }
    
    // Send transaction using the signer wallet client
    const [hash] = await this.writeContracts([call]);
    return hash;
  }

  async writeContracts(calls: Call[], options?: WriteContractsOptions): Promise<Hash[]> {
    if (!this.initialized || !this.kernelAccount) {
      throw new Error('Kernel wallet not initialized. Call init() first.');
    }

    if (!calls || calls.length === 0) {
      throw new Error('No calls provided for execution');
    }

    // Validate all calls have required fields
    for (let i = 0; i < calls.length; i++) {
      if (!calls[i].to) {
        throw new Error(`Invalid call at index ${i}: missing 'to' address`);
      }
    }

    const mode = this.executorEnabled ? 'executor' : 'signer';
    const activeSpan = api.trace.getActiveSpan();
    const span = activeSpan || this.otelService.startSpan('kernel.wallet.writeContracts', {
      attributes: {
        'kernel.execution_mode': mode,
        'kernel.calls_count': calls.length,
        'kernel.total_value': options?.value?.toString() ?? '0',
        'kernel.chain_id': this.chainId,
      },
    });

    try {
      this.logger.debug('Executing writeContracts', {
        mode,
        callsCount: calls.length,
        totalValue: options?.value?.toString(),
      });

      const result = await (this.executorEnabled
        ? this.writeWithExecutor(calls, options)
        : this.writeWithSigner(calls, options));
      
      if (!activeSpan) {
        span.setAttribute('kernel.tx_hashes', result.join(','));
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      
      return result;
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  async writeWithSigner(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));
    const activeSpan = api.trace.getActiveSpan();
    const span = activeSpan || this.otelService.startSpan('kernel.wallet.writeWithSigner', {
      attributes: {
        'kernel.account_address': this.kernelAccount.address,
        'kernel.total_value': totalValue.toString(),
        'kernel.chain_id': this.chainId,
      },
    });

    try {
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

      if (!activeSpan) {
        span.setAttribute('kernel.tx_hash', hash);
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      
      this.logger.log('Transaction sent via signer', { transactionHash: hash });

      return [hash];
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  async writeWithExecutor(calls: Call[], _options?: WriteContractsOptions): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));
    const activeSpan = api.trace.getActiveSpan();
    const span = activeSpan || this.otelService.startSpan('kernel.wallet.writeWithExecutor', {
      attributes: {
        'kernel.executor_address': this.ecdsaExecutorAddr,
        'kernel.total_value': totalValue.toString(),
        'kernel.chain_id': this.chainId,
      },
    });

    try {
      this.logger.debug('Executing transaction with executor mode', {
        executorAddress: this.ecdsaExecutorAddr,
        totalValue: totalValue.toString(),
      });

      const execution = encodeKernelExecuteParams(calls);

      if (!this.ecdsaExecutorAddr) {
        throw new Error('ECDSA executor address not configured but executor mode is enabled');
      }
      
      // Additional validation to ensure executor address is still valid
      if (!isAddress(this.ecdsaExecutorAddr)) {
        throw new Error(`Invalid ECDSA executor address: ${this.ecdsaExecutorAddr}`);
      }

      const nonceKey = 0n;
      let nonce: bigint;
      try {
        nonce = (await this.publicClient.readContract({
          address: this.ecdsaExecutorAddr,
          abi: ecdsaExecutorAbi,
          functionName: 'getNonce',
          args: [this.kernelAccount.address, nonceKey],
        })) as bigint;
      } catch (error) {
        const msg = `Failed to get nonce from ECDSA executor`;
        this.logger.error(msg, error as Error);
        throw new Error(`${msg}: ${(error as Error).message}`);
      }

      // TODO: Make expiration time configurable
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

      let signature: Hex;
      try {
        signature = await this.signerWalletClient.signMessage({
          message: { raw: executionHash },
        } as any);
      } catch (error) {
        const msg = `Failed to sign execution hash`;
        this.logger.error(msg, error as Error);
        throw new Error(`${msg}: ${(error as Error).message}`);
      }

      // Send transaction using the signer wallet client
      const hash = await this.signerWalletClient.writeContract({
        address: this.ecdsaExecutorAddr!,
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

      if (!activeSpan) {
        span.setAttributes({
          'kernel.tx_hash': hash,
          'kernel.nonce': nonce.toString(),
          'kernel.expiration': expiration.toString(),
        });
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      
      this.logger.log('Transaction sent via executor', {
        transactionHash: hash,
        nonce: nonce.toString(),
        expiration: expiration.toString(),
      });

      return [hash];
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  private async installEcdsaExecutorModule(): Promise<void> {
    if (!this.ecdsaExecutorAddr) {
      this.logger.debug('ECDSA executor module installation skipped: no executor address configured');
      return;
    }

    // Validate executor address format
    if (!isAddress(this.ecdsaExecutorAddr)) {
      throw new Error(`Invalid ECDSA executor address format: ${this.ecdsaExecutorAddr}`);
    }

    const span = this.otelService.startSpan('kernel.wallet.installEcdsaExecutorModule', {
      attributes: {
        'kernel.executor_address': this.ecdsaExecutorAddr,
        'kernel.chain_id': this.chainId,
      },
    });

    try {
      this.logger.log('Checking ECDSA executor module installation', {
        executorAddress: this.ecdsaExecutorAddr,
      });

      // Module type 2 = executor in ERC-7579
      const moduleType = 2;
      span.setAttribute('kernel.module_type', moduleType);

      // Check if the module is already installed
      let isInstalled: boolean;
      try {
        isInstalled = await this.isModuleInstalled(moduleType, this.ecdsaExecutorAddr);
      } catch (error) {
        this.logger.warn('Failed to check module installation status, assuming not installed', {
          error: (error as Error).message,
          moduleAddress: this.ecdsaExecutorAddr,
        });
        isInstalled = false;
      }
      span.setAttribute('kernel.module_already_installed', isInstalled);
      
      if (isInstalled) {
        this.logger.log('ECDSA executor module already installed');
        this.executorEnabled = true;
        span.setStatus({ code: api.SpanStatusCode.OK });
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

      // Update cache after successful installation
      const cacheKey = `${moduleType}-${this.ecdsaExecutorAddr}`;
      this.moduleStatusCache.set(cacheKey, true);
      
      this.executorEnabled = true;
      span.setAttribute('kernel.module_installed', true);
      
      this.logger.log('ECDSA executor module installed successfully');
      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ 
        code: api.SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  private async isModuleInstalled(moduleType: number, moduleAddress: Address): Promise<boolean> {
    if (!this.kernelAccount?.address) {
      throw new Error('Kernel account not initialized');
    }

    if (!isAddress(moduleAddress)) {
      throw new Error(`Invalid module address: ${moduleAddress}`);
    }

    // Check cache first
    const cacheKey = `${moduleType}-${moduleAddress}`;
    if (this.moduleStatusCache.has(cacheKey)) {
      return this.moduleStatusCache.get(cacheKey)!;
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.kernelAccount.address,
        abi: KernelV3AccountAbi,
        functionName: 'isModuleInstalled',
        args: [BigInt(moduleType), moduleAddress, '0x'],
      });
      const isInstalled = result as boolean;
      
      // Cache the result
      this.moduleStatusCache.set(cacheKey, isInstalled);
      
      return isInstalled;
    } catch (error) {
      // If the call fails, it might mean the account doesn't support modules yet
      this.logger.debug('Failed to check module installation status', {
        error: (error as Error).message,
        moduleType,
        moduleAddress,
      });
      return false;
    }
  }

  private async installModule(
    moduleType: number,
    moduleAddress: Address,
    initData: Hex,
  ): Promise<void> {
    if (!isAddress(moduleAddress)) {
      throw new Error(`Invalid module address: ${moduleAddress}`);
    }
    const span = this.otelService.startSpan('kernel.wallet.installModule', {
      attributes: {
        'kernel.module_type': moduleType,
        'kernel.module_address': moduleAddress,
        'kernel.chain_id': this.chainId,
      },
    });

    try {
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

      span.setAttribute('kernel.install_tx_hash', hash);
      this.logger.log('Module installation transaction sent', { transactionHash: hash });

      // Wait for transaction confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        span.setAttributes({
          'kernel.install_gas_used': receipt.gasUsed?.toString() ?? '0',
          'kernel.install_status': 'success',
        });
        
        this.logger.log('Module installed successfully', {
          transactionHash: hash,
          gasUsed: receipt.gasUsed?.toString(),
          moduleType,
          moduleAddress,
        });
        
        span.setStatus({ code: api.SpanStatusCode.OK });
      } else {
        const error = `Module installation failed`;
        this.logger.error(error, undefined, {
          transactionHash: hash,
          moduleType,
          moduleAddress,
        });
        throw new Error(`${error}. Transaction hash: ${hash}`);
      }
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ 
        code: api.SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }
}
