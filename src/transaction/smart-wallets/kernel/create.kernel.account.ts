import {
  Account,
  Chain,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionData,
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
