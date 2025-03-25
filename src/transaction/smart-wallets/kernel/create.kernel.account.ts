import {
  Account,
  Chain,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  Hex,
  LocalAccount,
  OneOf,
  parseAbi,
  publicActions,
  Transport,
  WalletClient,
  zeroAddress,
} from 'viem'
import { KernelAccountClientConfig } from './kernel-account.config'
import {
  DeployFactoryArgs,
  KernelAccountActions,
  KernelAccountClient,
} from './kernel-account.client'
import { EthereumProvider } from 'permissionless/utils/toOwner'
import { KernelVersion, toEcdsaKernelSmartAccount } from 'permissionless/accounts'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Logger } from '@nestjs/common'
import {
  GLOBAL_CONSTANTS,
} from '@rhinestone/module-sdk'
import { OwnableExecutorAbi } from '@/contracts/OwnableExecutor.abi'

export type entryPointV_0_7 = '0.7'

export async function createKernelAccountClient<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  > = LocalAccount,
>(
  parameters: KernelAccountClientConfig<entryPointVersion, KernelVersion<entryPointVersion>, owner>,
): Promise<{ client: KernelAccountClient<entryPointVersion>; args: DeployFactoryArgs }> {
  const { key = 'kernelAccountClient', name = 'Kernel Account Client', transport } = parameters
  const { account } = parameters

  let client = createWalletClient({
    ...parameters,
    account,
    key,
    name,
    transport,
  }) as KernelAccountClient<entryPointVersion>

  const kernelAccount = await toEcdsaKernelSmartAccount<
    entryPointVersion,
    KernelVersion<entryPointVersion>,
    owner
  >({
    ...parameters,
    client,
  })

  if (kernelAccount.address === zeroAddress) {
    const { factoryData: factoryStakerData } = await kernelAccount.getFactoryArgs()

    if (factoryStakerData) {
      const { args } = decodeFunctionData({
        abi: parseAbi([
          'function deployWithFactory(address factory, bytes calldata createData, bytes32 salt) external payable returns (address)',
        ]),
        data: factoryStakerData,
      })

      const [factory, createdData, salt] = args

      const publicClient = createPublicClient({
        ...parameters,
      })

      const KernelFactoryABI = parseAbi([
        'function getAddress(bytes calldata data, bytes32 salt) view returns (address)',
      ])

      const { data } = await publicClient.call({
        to: factory,
        data: encodeFunctionData({
          functionName: 'getAddress',
          abi: KernelFactoryABI,
          args: [createdData, salt],
        }),
      })

      const address = decodeFunctionResult({
        abi: KernelFactoryABI,
        functionName: 'getAddress',
        data: data!,
      })

      kernelAccount.address = address as Hex
    }
  }

  client.kernelAccount = kernelAccount
  client.kernelAccountAddress = kernelAccount.address
  client = client.extend(KernelAccountActions).extend(publicActions) as any

  //conditionally deploys kernel account if it doesn't exist
  const args = await client.deployKernelAccount()
  return { client, args }
}

/**
 * Encodes the calldata for the OwnableExecutor executeOnOwnedAccount function in order to
 * transfer an erc20 token owned by the kernel account.
 * @param kernelAccountAddress the kernel account address
 * @param tx the transfer transaction on the erc20 token to encode
 * @returns
 */
export function getExecutorTransferData(
  kernelAccountAddress: Hex,
  tx: { to: Hex; amount: bigint; tokenAddress: Hex },
) {
  //Encode the transfer function of the ERC20 token
  const transferCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [tx.to, tx.amount],
  })

  //Encode the calldata for the OwnableExecutor executeOnOwnedAccount function
  const packed = encodePacked(
    ['address', 'uint256', 'bytes'],
    [tx.tokenAddress, BigInt(Number(0)), transferCalldata],
  )

  const executorCall = encodeFunctionData({
    abi: OwnableExecutorAbi,
    functionName: 'executeOnOwnedAccount',
    args: [kernelAccountAddress, packed], //the owned account is the kernel account
  })
  return executorCall
}

/**
 * Transfers an ERC20 token from an OwnableExecutor eip-7975 module. It
 * calls the underlying `executeOnOwnedAccount` function of the module that then calls the
 * owned Kernel wallet. Serves for generating the calldata needed for the transfer.
 * Calldata should be executed on the executor contract.
 *
 * @param client the kernel account client
 * @param tx the token tx data
 */
export async function executorTransferERC20Token<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7,
>(
  client: KernelAccountClient<entryPointVersion>,
  tx: { to: Hex; amount: bigint; tokenAddress: Hex },
) {
  const logger = getLogger()

  //Encode the transfer function of the ERC20 token
  const transferCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [tx.to, tx.amount],
  })

  //Encode the calldata for the OwnableExecutor executeOnOwnedAccount function
  const packed = encodePacked(
    ['address', 'uint256', 'bytes'],
    [tx.tokenAddress, BigInt(Number(0)), transferCalldata],
  )

  // Simulate the contract call
  const { request } = await client.simulateContract({
    address: GLOBAL_CONSTANTS.OWNABLE_EXECUTOR_ADDRESS,
    abi: OwnableExecutorAbi,
    functionName: 'executeOnOwnedAccount',
    args: [client.kernelAccount.address, packed], //the owned account is the kernel account
    account: client.kernelAccount.client.account, //assumes the kernel account signer is the owner of the executor for the kernel contract
  })

  logger.log(
    EcoLogMessage.fromDefault({
      message: `simulated OwnableExecutor executeOnOwnedAccount token transfer`,
      properties: {
        kernelAccount: client.kernelAccount.address,
        request,
      },
    }),
  )
}

function getLogger() {
  return new Logger('OwnableExecutor')
}
