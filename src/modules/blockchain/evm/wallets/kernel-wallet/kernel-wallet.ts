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
  LocalAccount,
  Transport,
  WalletClient,
} from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import { EvmCall, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { sum } from '@/common/utils/math';
import { now } from '@/common/utils/time';
import { EvmNetworkConfig, KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { EvmWalletManager } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
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

// Default OwnableExecutor module address (Rhinestone)
const DEFAULT_OWNABLE_EXECUTOR_ADDRESS: Address = '0x4Fd8d57b94966982B62e9588C27B4171B55E8354';

type KernelAccount = Awaited<ReturnType<typeof createKernelAccount>>;

export class KernelWallet extends BaseEvmWallet {
  private kernelAccount!: KernelAccount;
  private readonly ecdsaExecutorAddr?: Address;
  private readonly ownableExecutorAddr?: Address;
  private readonly publicClient: ReturnType<EvmTransportService['getPublicClient']>;
  private readonly signerWalletClient: WalletClient<Transport, Chain<ChainFormatters>>;

  private initialized = false;
  private executorEnabled = false;
  private ownableExecutorEnabled = false;

  constructor(
    private readonly chainId: number,
    private readonly signer: LocalAccount,
    private readonly kernelWalletConfig: KernelWalletConfig,
    private readonly networkConfig: EvmNetworkConfig,
    private readonly transportService: EvmTransportService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly evmWalletManager: EvmWalletManager,
  ) {
    super();

    const chain = this.transportService.getViemChain(chainId);
    const transport = this.transportService.getTransport(chainId);

    const signerWalletClient = createWalletClient({
      account: signer,
      chain,
      transport,
    });

    // Validate ECDSA executor address if provided
    const executorAddr = this.networkConfig.contracts?.ecdsaExecutor;
    if (executorAddr) {
      if (!isAddress(executorAddr)) {
        throw new Error(`Invalid ECDSA executor address: ${executorAddr}`);
      }
      this.ecdsaExecutorAddr = executorAddr as Address;
    }

    // Configure OwnableExecutor address if enabled
    const ownableConfig = this.kernelWalletConfig.ownableExecutor;
    if (ownableConfig) {
      // Check if this chain is excluded
      const isExcluded = ownableConfig.excludeChains?.includes(chainId) ?? false;

      if (!isExcluded) {
        // Use override address if provided for this chain, otherwise use default
        const moduleAddr =
          ownableConfig.overrideModuleAddress?.[chainId] ?? DEFAULT_OWNABLE_EXECUTOR_ADDRESS;

        if (!isAddress(moduleAddr)) {
          throw new Error(`Invalid OwnableExecutor module address: ${moduleAddr}`);
        }
        this.ownableExecutorAddr = moduleAddr as Address;
      }
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

    const tracer = this.otelService.getTracer();
    return tracer.startActiveSpan(
      'kernel.wallet.init',
      {
        attributes: {
          'kernel.chain_id': this.chainId,
          'kernel.signer_address': this.signer.address,
          'kernel.version': kernelVersion,
        },
      },
      async (span: api.Span) => {
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

          // Install configured modules
          await this.installConfiguredModules();

          this.initialized = true;
          span.setAttribute('kernel.executor_enabled', this.executorEnabled);
          span.setAttribute('kernel.ownable_executor_enabled', this.ownableExecutorEnabled);

          this.logger.log('Kernel wallet initialization complete', {
            executorEnabled: this.executorEnabled,
            ownableExecutorEnabled: this.ownableExecutorEnabled,
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
      },
    );
  }

  async deploy(kernelAccount: KernelAccount) {
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'kernel.wallet.deploy',
      {
        attributes: {
          'kernel.account_address': kernelAccount.address,
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
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
      },
    );
  }

  async getAddress(): Promise<Address> {
    if (!this.initialized || !this.kernelAccount) {
      throw new Error('Kernel wallet not initialized. Call init() first.');
    }
    return this.kernelAccount.address;
  }

  async getMetadata(): Promise<Record<string, string>> {
    return {
      signer: this.signer.address,
      mode: this.getExecutionMode(),
    };
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
    const tracer = this.otelService.tracer;

    return tracer.startActiveSpan(
      'kernel.wallet.writeContracts',
      {
        attributes: {
          'kernel.execution_mode': mode,
          'kernel.calls_count': calls.length,
          'kernel.total_value': options?.value?.toString() ?? '0',
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
        try {
          this.logger.debug('Executing writeContracts', {
            mode,
            callsCount: calls.length,
            totalValue: options?.value?.toString(),
          });

          const result = await (mode === 'executor'
            ? this.writeWithExecutor(calls, options)
            : this.writeWithSigner(calls, options));

          span.setAttribute('kernel.tx_hashes', result.join(','));
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  protected async writeWithSigner(
    calls: EvmCall[],
    _options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));
    const tracer = this.otelService.tracer;

    return tracer.startActiveSpan(
      'kernel.wallet.writeWithSigner',
      {
        attributes: {
          'kernel.account_address': this.kernelAccount.address,
          'kernel.total_value': totalValue.toString(),
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
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

          span.setAttribute('kernel.tx_hash', hash);
          span.setStatus({ code: api.SpanStatusCode.OK });

          this.logger.log('Transaction sent via signer', { transactionHash: hash });

          span.end();
          return [hash];
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          span.end();
          throw error;
        }
      },
    );
  }

  protected async writeWithExecutor(
    calls: EvmCall[],
    _options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    const totalValue = _options?.value ?? sum(calls.map((call) => call.value ?? 0n));
    const tracer = this.otelService.tracer;

    return tracer.startActiveSpan(
      'kernel.wallet.writeWithExecutor',
      {
        attributes: {
          'kernel.executor_address': this.ecdsaExecutorAddr,
          'kernel.total_value': totalValue.toString(),
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
        try {
          this.logger.debug('Executing transaction with executor mode', {
            executorAddress: this.ecdsaExecutorAddr,
            totalValue: totalValue.toString(),
          });

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

          // Use configured expiration time (default: 30 minutes)
          const expirationSeconds = this.kernelWalletConfig.executorSignatureExpiration ?? 1800;
          const expiration = BigInt(now() + expirationSeconds);

          // EIP-712 domain and types
          const domain = {
            name: 'ECDSAExecutor',
            version: '1',
            chainId: this.chainId,
            verifyingContract: this.ecdsaExecutorAddr,
          } as const;

          // EIP-712 types definition
          const types = {
            Execute: [
              { name: 'account', type: 'address' },
              { name: 'mode', type: 'uint256' },
              { name: 'executionCalldata', type: 'bytes' },
              { name: 'nonce', type: 'uint256' },
              { name: 'expiration', type: 'uint256' },
            ],
          } as const;

          // Message to sign
          const message = {
            account: this.kernelAccount.address,
            mode: BigInt(execution.mode),
            executionCalldata: execution.callData,
            nonce,
            expiration,
          };

          let signature: Hex;
          try {
            signature = await this.signerWalletClient.signTypedData({
              account: this.signer,
              domain,
              types,
              primaryType: 'Execute',
              message,
            });
          } catch (error) {
            const msg = `Failed to sign EIP-712 typed data`;
            this.logger.error(msg, toError(error));
            throw new Error(`${msg}: ${getErrorMessage(error)}`);
          }

          // Get BasicWallet instance from EvmWalletManager
          const basicWallet = this.evmWalletManager.getWallet('basic', this.chainId);

          let hash: Hash;
          try {
            // Encode the transaction data
            const txData = encodeFunctionData({
              abi: ecdsaExecutorAbi,
              functionName: 'execute',
              args: [
                this.kernelAccount.address,
                execution.mode,
                execution.callData,
                nonce,
                expiration,
                signature,
              ],
            });

            // Send transaction using BasicWallet - use writeContracts with single call to support gas option
            const hashes = await basicWallet.writeContracts(
              [
                {
                  to: this.ecdsaExecutorAddr!,
                  data: txData,
                  value: totalValue,
                },
              ],
              {
                gas: _options?.gas,
              },
            );
            hash = hashes[0];
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

          span.setAttributes({
            'kernel.tx_hash': hash,
            'kernel.nonce': nonce.toString(),
            'kernel.expiration': expiration.toString(),
          });
          span.setStatus({ code: api.SpanStatusCode.OK });

          this.logger.log('Transaction sent via executor', {
            transactionHash: hash,
            nonce: nonce.toString(),
            expiration: expiration.toString(),
          });

          span.end();
          return [hash];
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          span.end();
          throw error;
        }
      },
    );
  }

  /**
   * Installs all configured modules on the kernel account.
   * This method orchestrates the installation of ECDSA Executor and OwnableExecutor modules.
   */
  private async installConfiguredModules(): Promise<void> {
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'kernel.wallet.installConfiguredModules',
      {
        attributes: {
          'kernel.chain_id': this.chainId,
          'kernel.ecdsa_executor_configured': !!this.ecdsaExecutorAddr,
          'kernel.ownable_executor_configured': !!this.ownableExecutorAddr,
        },
      },
      async (span: api.Span) => {
        try {
          // Install ECDSA Executor module if configured
          await this.installEcdsaExecutorModule();

          // Install OwnableExecutor module if configured
          await this.installOwnableExecutorModule();

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
      },
    );
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

    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'kernel.wallet.installEcdsaExecutorModule',
      {
        attributes: {
          'kernel.executor_address': this.ecdsaExecutorAddr,
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
        try {
          this.logger.log('Checking ECDSA executor module installation', {
            executorAddress: this.ecdsaExecutorAddr,
          });

          // Module type 2 = executor in ERC-7579
          const moduleType = 2;
          span.setAttribute('kernel.module_type', moduleType);

          if (!this.ecdsaExecutorAddr) {
            throw new Error('ECDSA executor address not configured');
          }

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
          const executorInitData = encodeAbiParameters(
            [{ type: 'address' }],
            [this.signer.address],
          );
          const moduleInitData = constructInitDataWithHook(executorInitData);

          // Install the module
          if (!this.ecdsaExecutorAddr) {
            throw new Error('ECDSA executor address not configured');
          }
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
        }
      },
    );
  }

  private async installOwnableExecutorModule(): Promise<void> {
    if (!this.ownableExecutorAddr) {
      this.logger.debug(
        'OwnableExecutor module installation skipped: no module address configured',
        { chainId: this.chainId },
      );
      return;
    }

    const ownableConfig = this.kernelWalletConfig.ownableExecutor;
    if (!ownableConfig) {
      this.logger.debug('OwnableExecutor module installation skipped: no configuration provided');
      return;
    }

    // Validate executor address format
    if (!isAddress(this.ownableExecutorAddr)) {
      throw new Error(`Invalid OwnableExecutor module address format: ${this.ownableExecutorAddr}`);
    }

    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'kernel.wallet.installOwnableExecutorModule',
      {
        attributes: {
          'kernel.ownable_executor_address': this.ownableExecutorAddr,
          'kernel.ownable_executor_owner': ownableConfig.owner,
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
        try {
          this.logger.log('Checking OwnableExecutor module deployment on chain', {
            moduleAddress: this.ownableExecutorAddr,
            chainId: this.chainId,
          });

          if (!this.ownableExecutorAddr) {
            throw new Error('OwnableExecutor module address not configured');
          }

          // Check if the module is deployed on this chain
          const isDeployed = await this.isModuleDeployedOnChain(this.ownableExecutorAddr);
          span.setAttribute('kernel.module_deployed', isDeployed);

          if (!isDeployed) {
            this.logger.warn('OwnableExecutor module not deployed on this chain, skipping', {
              chainId: this.chainId,
              moduleAddress: this.ownableExecutorAddr,
            });
            span.setStatus({ code: api.SpanStatusCode.OK });
            return;
          }

          this.logger.log('Checking OwnableExecutor module installation', {
            chainId: this.chainId,
            moduleAddress: this.ownableExecutorAddr,
          });

          // Module type 2 = executor in ERC-7579
          const moduleType = 2;
          span.setAttribute('kernel.module_type', moduleType);

          // Check if the module is already installed
          let isInstalled: boolean;
          try {
            isInstalled = await this.isModuleInstalled(moduleType, this.ownableExecutorAddr);
          } catch (error) {
            this.logger.warn('Failed to check module installation status, assuming not installed', {
              chainId: this.chainId,
              error: getErrorMessage(error),
              moduleAddress: this.ownableExecutorAddr,
            });
            isInstalled = false;
          }
          span.setAttribute('kernel.module_already_installed', isInstalled);

          if (isInstalled) {
            this.logger.log('OwnableExecutor module already installed');
            this.ownableExecutorEnabled = true;
            span.setStatus({ code: api.SpanStatusCode.OK });
            return;
          }

          this.logger.log('Installing OwnableExecutor module', {
            chainId: this.chainId,
            moduleType,
            moduleAddress: this.ownableExecutorAddr,
            owner: ownableConfig.owner,
          });

          // Encode the owner address as the init data for the OwnableExecutor module
          const executorInitData = encodePacked(['address'], [ownableConfig.owner]);
          const moduleInitData = constructInitDataWithHook(executorInitData);

          // Install the module
          await this.installModule(moduleType, this.ownableExecutorAddr, moduleInitData);

          this.ownableExecutorEnabled = true;
          span.setAttribute('kernel.module_installed', true);

          this.logger.log('OwnableExecutor module installed successfully');
          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        }
      },
    );
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

  /**
   * Checks if a module is deployed on the current chain by checking if it has bytecode.
   * @param moduleAddress The address of the module to check
   * @returns true if the module is deployed (has code), false otherwise
   */
  private async isModuleDeployedOnChain(moduleAddress: Address): Promise<boolean> {
    if (!isAddress(moduleAddress)) {
      throw new Error(`Invalid module address: ${moduleAddress}`);
    }

    try {
      const code = await this.publicClient.getCode({ address: moduleAddress });
      // If code is undefined, '0x', or '0x0', the contract is not deployed
      return !!(code && code !== '0x' && code !== '0x0');
    } catch (error) {
      this.logger.debug('Failed to check module deployment', {
        error: getErrorMessage(error),
        moduleAddress,
        chainId: this.chainId,
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
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'kernel.wallet.installModule',
      {
        attributes: {
          'kernel.module_type': moduleType,
          'kernel.module_address': moduleAddress,
          'kernel.chain_id': this.chainId,
        },
      },
      async (span: api.Span) => {
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
      },
    );
  }
}
