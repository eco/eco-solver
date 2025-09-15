import * as api from '@opentelemetry/api';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, KernelV3AccountAbi, KernelValidator } from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  Address,
  Chain,
  ChainFormatters,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  Hash,
  Hex,
  isAddress,
  keccak256,
  LocalAccount,
  Transport,
  WalletClient,
} from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import { EvmCall, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { sum } from '@/common/utils/math';
import { minutes, now } from '@/common/utils/time';
import { EvmNetworkConfig, KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { ecdsaExecutorAbi } from '@/modules/blockchain/evm/wallets/kernel-wallet/constants/ecdsa-executor.abi';
import {
  encodeKernelExecuteCallData,
  encodeKernelExecuteParams,
} from '@/modules/blockchain/evm/wallets/kernel-wallet/utils/encode-transactions';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { constructInitDataWithHook } from './utils/encode-module';

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
      let ecdsaValidator: KernelValidator<'ECDSAValidator'>;
      try {
        // Note: Type assertion needed due to Zerodev SDK type incompatibility with viem v2
        ecdsaValidator = await signerToEcdsaValidator(this.publicClient as any, {
          signer: this.signer,
          entryPoint: entryPoint!,
          kernelVersion,
        });
      } catch (error) {
        const msg = `Failed to create ECDSA validator for kernel wallet`;
        this.logger.error(msg, toError(error));
        throw new Error(`${msg}: ${getErrorMessage(error)}`);
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
        this.logger.error(msg, toError(error));
        throw new Error(`${msg}: ${getErrorMessage(error)}`);
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
        this.logger.error(msg, toError(error));
        throw new Error(`${msg}: ${getErrorMessage(error)}`);
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
      span.recordException(toError(error));
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: getErrorMessage(error),
      });
      this.logger.error('Kernel wallet initialization failed', toError(error), {
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
      // Double-check deployment status before getting factory args (performance optimization)
      const code = await this.publicClient.getCode({ address: kernelAccount.address });
      if (code && code !== '0x') {
        this.logger.debug('Account already has code deployed, skipping deployment');
        span.setAttribute('kernel.already_deployed', true);
        span.setStatus({ code: api.SpanStatusCode.OK });
        return;
      }

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

      // Note: Using 'as any' due to complex viem type constraints for deployment transaction
      const hash = await this.signerWalletClient.sendTransaction({
        to: factory,
        data: factoryData,
      } as any);

      span.setAttribute('kernel.deployment_tx_hash', hash);
      this.logger.log('Deployment transaction sent', { transactionHash: hash });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      span.setAttributes({
        'kernel.deployment_gas_used': receipt.gasUsed?.toString() ?? '0',
        'kernel.deployment_status': 'success',
      });

      this.logger.log('Kernel account deployed successfully', {
        transactionHash: hash,
        gasUsed: receipt.gasUsed?.toString(),
      });

      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: getErrorMessage(error),
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
   * Get current execution mode
   * @returns Current execution mode based on executor status
   */
  getExecutionMode(): 'executor' | 'signer' {
    return this.executorEnabled ? 'executor' : 'signer';
  }

  async writeContract(call: EvmCall): Promise<Hash> {
    if (!call || !call.to) {
      throw new Error('Invalid call parameters: missing required fields');
    }

    // Send transaction using the signer wallet client
    const [hash] = await this.writeContracts([call]);
    return hash;
  }

  async writeContracts(calls: EvmCall[], options?: WriteContractsOptions): Promise<Hash[]> {
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

    // Determine execution mode based on executor availability and options
    const mode = this.getExecutionMode();
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('kernel.wallet.writeContracts', {
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

      const result = await (mode === 'executor'
        ? this.writeWithExecutor(calls, options)
        : this.writeWithSigner(calls, options));

      if (!activeSpan) {
        span.setAttribute('kernel.tx_hashes', result.join(','));
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      return result;
    } catch (error) {
      if (!activeSpan) {
        span.recordException(toError(error));
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: getErrorMessage(error),
        });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  protected async writeWithSigner(
    calls: EvmCall[],
    _options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('kernel.wallet.writeWithSigner', {
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
        gas: _options?.gas,
      } as any);

      if (!activeSpan) {
        span.setAttribute('kernel.tx_hash', hash);
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      this.logger.log('Transaction sent via signer', { transactionHash: hash });

      return [hash];
    } catch (error) {
      if (!activeSpan) {
        span.recordException(toError(error));
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: getErrorMessage(error),
        });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  protected async writeWithExecutor(
    calls: EvmCall[],
    _options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('kernel.wallet.writeWithExecutor', {
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

      await this.checkKernelAccountBalance(totalValue, span);

      const execution = encodeKernelExecuteParams(calls);

      if (!this.ecdsaExecutorAddr) {
        throw new Error('ECDSA executor address not configured but executor mode is enabled');
      }

      // Additional validation to ensure the executor address is still valid
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
        this.logger.error(msg, toError(error));
        throw new Error(`${msg}: ${getErrorMessage(error)}`);
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
        this.logger.error(msg, toError(error));
        throw new Error(`${msg}: ${getErrorMessage(error)}`);
      }

      let hash: Hash;
      try {
        // Send transaction using the signer wallet client
        hash = await this.signerWalletClient.writeContract({
          address: this.ecdsaExecutorAddr!,
          abi: ecdsaExecutorAbi,
          functionName: 'execute',
          value: totalValue,
          gas: _options?.gas,
          args: [
            this.kernelAccount.address,
            execution.mode,
            execution.callData,
            nonce,
            expiration,
            signature,
          ],
        } as any);
      } catch (error) {
        // Check if error is due to executor issues
        const errorMessage = getErrorMessage(error).toLowerCase();
        if (errorMessage.includes('expired') || errorMessage.includes('invalid signature')) {
          this.logger.warn('Executor transaction failed, may need to retry', {
            error: errorMessage,
            nonce: nonce.toString(),
            expiration: expiration.toString(),
          });
        }
        throw error;
      }

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
        span.recordException(toError(error));
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: getErrorMessage(error),
        });
      }

      // Log executor-specific error details
      this.logger.error('Executor transaction failed', toError(error), {
        executorAddress: this.ecdsaExecutorAddr,
        totalValue: totalValue.toString(),
      });

      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  private async installEcdsaExecutorModule(): Promise<void> {
    if (!this.ecdsaExecutorAddr) {
      this.logger.debug(
        'ECDSA executor module installation skipped: no executor address configured',
      );
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
          error: getErrorMessage(error),
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
      const executorInitData = encodePacked(['address'], [this.signer.address]);
      const moduleInitData = constructInitDataWithHook(executorInitData);

      // Install the module
      await this.installModule(moduleType, this.ecdsaExecutorAddr, moduleInitData);

      this.executorEnabled = true;
      span.setAttribute('kernel.module_installed', true);

      this.logger.log('ECDSA executor module installed successfully');
      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: getErrorMessage(error),
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

    try {
      return await this.publicClient.readContract({
        address: this.kernelAccount.address,
        abi: KernelV3AccountAbi,
        functionName: 'isModuleInstalled',
        args: [BigInt(moduleType), moduleAddress, '0x'],
      });
    } catch (error) {
      // If the call fails, it might mean the account doesn't support modules yet
      this.logger.debug('Failed to check module installation status', {
        error: getErrorMessage(error),
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
      span.recordException(toError(error));
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: getErrorMessage(error),
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Checks if the kernel account has sufficient ETH balance for the transaction.
   * Only performs the check if totalValue is greater than zero.
   */
  private async checkKernelAccountBalance(totalValue: bigint, span: api.Span): Promise<void> {
    if (totalValue <= 0n) {
      span.setAttribute('kernel.balance_check_skipped', true);
      span.setAttribute('kernel.balance_check_reason', 'zero_value');
      return;
    }

    span.setAttribute('kernel.balance_check_performed', true);

    const kernelBalance = await this.publicClient.getBalance({
      address: this.kernelAccount.address,
    });

    const sufficient = kernelBalance >= totalValue;

    span.setAttributes({
      'kernel.account_balance': kernelBalance.toString(),
      'kernel.required_balance': totalValue.toString(),
      'kernel.balance_sufficient': sufficient,
    });

    this.logger.debug('Kernel account balance check', {
      kernelAddress: this.kernelAccount.address,
      balance: kernelBalance.toString(),
      requiredValue: totalValue.toString(),
      sufficient,
    });

    if (!sufficient) {
      const shortfall = totalValue - kernelBalance;
      span.setAttribute('kernel.balance_shortfall', shortfall.toString());

      throw new Error(
        `Kernel account has insufficient ETH balance. ` +
          `Required: ${totalValue.toString()} wei, ` +
          `Available: ${kernelBalance.toString()} wei. ` +
          `Please fund the Kernel account at ${this.kernelAccount.address} with at least ${shortfall.toString()} wei additional ETH.`,
      );
    }
  }
}
