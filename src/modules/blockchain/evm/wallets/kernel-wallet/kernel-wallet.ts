import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount } from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  Address,
  createWalletClient,
  encodeFunctionData,
  Hash,
  Hex,
  LocalAccount,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import {
  ReadContractParams,
  WriteContractParams,
  WriteContractsOptions,
} from '@/common/interfaces/evm-wallet.interface';
import { KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';

const kernelVersion = KERNEL_V3_1;
const entryPoint = getEntryPoint('0.7');

type KernelAccount = Awaited<ReturnType<typeof createKernelAccount>>;

export class KernelWallet extends BaseEvmWallet {
  private signer: LocalAccount;
  private kernelAccount!: KernelAccount;
  private readonly publicClient: ReturnType<EvmTransportService['getPublicClient']>;
  private readonly signerWalletClient: WalletClient;

  private initialized = false;

  constructor(
    private readonly chainId: number,
    private readonly config: KernelWalletConfig,
    private readonly transportService: EvmTransportService,
  ) {
    super();

    if (config.signer.type !== 'eoa') {
      throw new Error('Signer must be a eoa');
    }

    const chain = this.transportService.getViemChain(chainId);
    const transport = this.transportService.getTransport(chainId);
    const signer = privateKeyToAccount(config.signer.privateKey as Hex);

    const signerWalletClient = createWalletClient({
      account: signer,
      chain,
      transport,
    });

    this.signer = signer;
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
    if (!this.initialized) {
      await this.init();
    }
    return this.kernelAccount.address;
  }

  async readContract(params: ReadContractParams): Promise<any> {
    // Ensure kernel account is initialized for getting the address if needed
    if (!this.initialized) {
      await this.init();
    }

    return this.publicClient.readContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });
  }

  async readContracts(params: ReadContractParams[]): Promise<any[]> {
    // Ensure kernel account is initialized for getting the address if needed
    if (!this.initialized) {
      await this.init();
    }

    const contracts = params.map((param) => ({
      address: param.address,
      abi: param.abi,
      functionName: param.functionName,
      args: param.args || [],
    }));

    const results = await (this.publicClient as any).multicall({ contracts });
    return results.map((result: any) => result.result);
  }

  async writeContract(params: WriteContractParams): Promise<Hash> {
    if (!this.initialized) {
      await this.init();
    }

    const callData = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });

    // ERC-7579 execute function ABI
    const kernelExecuteAbi = [
      {
        name: 'execute',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
      },
    ];

    // Encode the execute call for the kernel account
    const executeCallData = encodeFunctionData({
      abi: kernelExecuteAbi,
      functionName: 'execute',
      args: [params.address, params.value || 0n, callData],
    });

    // Send transaction using the signer wallet client
    return this.signerWalletClient.sendTransaction({
      to: this.kernelAccount.address,
      data: executeCallData,
      value: params.value || 0n,
    } as any);
  }

  async writeContracts(
    params: WriteContractParams[],
    _options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    if (!this.initialized) {
      await this.init();
    }

    // ERC-7579 executeBatch function ABI
    const executeBatchAbi = [
      {
        name: 'executeBatch',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: 'targets', type: 'address[]' },
          { name: 'values', type: 'uint256[]' },
          { name: 'datas', type: 'bytes[]' },
        ],
        outputs: [],
      },
    ];

    const targets: Address[] = [];
    const values: bigint[] = [];
    const datas: `0x${string}`[] = [];
    let totalValue = 0n;

    for (const param of params) {
      targets.push(param.address);
      values.push(param.value || 0n);
      datas.push(
        encodeFunctionData({
          abi: param.abi,
          functionName: param.functionName,
          args: param.args,
        }),
      );
      totalValue += param.value || 0n;
    }

    // Encode the executeBatch call for the kernel account
    const executeBatchCallData = encodeFunctionData({
      abi: executeBatchAbi,
      functionName: 'executeBatch',
      args: [targets, values, datas],
    });

    // Send transaction using the signer wallet client
    const hash = await this.signerWalletClient.sendTransaction({
      to: this.kernelAccount.address,
      data: executeBatchCallData,
      value: totalValue,
    } as any);

    return [hash];
  }
}
