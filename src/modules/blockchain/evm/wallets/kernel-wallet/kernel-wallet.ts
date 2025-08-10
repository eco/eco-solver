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

      span.setAttribute('kernel.account_address', this.kernelAccount.address);
      this.logger.log('Kernel account created', {
        accountAddress: this.kernelAccount.address,
      });

      const isDeployed = await this.kernelAccount.isDeployed();
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
    return this.kernelAccount.address;
  }

  async writeContract(call: Call): Promise<Hash> {
    // Send transaction using the signer wallet client
    const [hash] = await this.writeContracts([call]);
    return hash;
  }

  async writeContracts(calls: Call[], options?: WriteContractsOptions): Promise<Hash[]> {
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
      const isInstalled = await this.isModuleInstalled(moduleType, this.ecdsaExecutorAddr);
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
