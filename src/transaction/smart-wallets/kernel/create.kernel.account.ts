import { KernelAccountActions, KernelWalletActions } from '@/transaction/smart-wallets/kernel'
import { getAccount, getOwnableExecutor, installModule } from '@rhinestone/module-sdk'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import {
  createKernelAccount,
  getUserOperationGasPrice,
  KernelAccountClient,
  kernelAccountClientActions,
  KernelAccountClientActions,
  SmartAccountClientConfig,
} from '@zerodev/sdk'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import {
  Chain,
  Client,
  createClient,
  createPublicClient,
  createWalletClient,
  LocalAccount,
  Prettify,
  PublicActions,
  publicActions,
  RpcSchema,
  Transport,
  walletActions,
} from 'viem'

import { entryPoint07Address, EntryPointVersion, type SmartAccount } from 'viem/account-abstraction'

export type KernelAccountClientWithoutBundler<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends SmartAccount | undefined = SmartAccount | undefined,
  client extends Client | undefined = Client | undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  Omit<
    KernelAccountClient<transport, chain, account, client, rpcSchema>,
    'rpcSchema' | 'actions'
  > & {
    rpcSchema: rpcSchema
    extended: KernelAccountClientActions<chain, account>
  } & PublicActions<transport, chain> &
  KernelWalletActions
>

export type SmartAccountClientConfigWithoutBundler<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends SmartAccount = SmartAccount,
  client extends Client | undefined = Client | undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  Omit<
    SmartAccountClientConfig<transport, chain, account, client, rpcSchema>,
    'bundlerTransport'
  > & {
    transport: transport
  }
>
///https://github.com/zerodevapp/zerodev-examples/blob/main/create-ecdsa-migration-account/main.ts
export function createKernelAccountClient(
  parameters: SmartAccountClientConfigWithoutBundler,
): KernelAccountClientWithoutBundler {
  const {
    client: client_,
    key = 'Account',
    name = 'Kernel Account Client',
    paymaster,
    paymasterContext,
    transport,
    userOperation,
  } = parameters

  const client = Object.assign(
    createClient({
      ...parameters,
      chain: parameters.chain ?? client_?.chain,
      transport,
      key,
      name,
      type: 'kernelAccountClient',
      pollingInterval: parameters.pollingInterval ?? 1000,
    }),
    { client: client_, paymaster, paymasterContext, userOperation },
  )

  if (!client.userOperation?.estimateFeesPerGas) {
    client.userOperation = {
      ...client.userOperation,
      estimateFeesPerGas: async ({ bundlerClient }) => {
        return await getUserOperationGasPrice(bundlerClient)
      },
    }
  }

  return client.extend(kernelAccountClientActions()) as KernelAccountClientWithoutBundler
}

export async function buildKernelAccountClient(
  parameters: SmartAccountClientConfigWithoutBundler,
): Promise<KernelAccountClientWithoutBundler> {
  const kernelVersion = KERNEL_V3_1
  const entryPoint = {
    address: entryPoint07Address,
    version: '0.7' as EntryPointVersion,
  }
  const { transport, chain, account: signer } = parameters
  const publicClient = createPublicClient({
    transport,
    chain,
  })

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: signer as LocalAccount,
    entryPoint: entryPoint!,
    kernelVersion,
  })

  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    useMetaFactory: false,
    entryPoint: entryPoint as any,
    kernelVersion,
  })


  // const kernelClient = createKernelAccountClient({
  //   account: kernelAccount,
  //   chain,
  //   transport,
  //   client: publicClient,
  // })
  // .extend(publicActions)
  // .extend(walletActions)
  // .extend(KernelAccountActions as any) as KernelAccountClientWithoutBundler
  // // Sending a dummy transaction just to deploy the account
  // console.log('kernel account deployed ? ' + kernelClient.account?.isDeployed())
  // console.log('kernel account address: ' + kernelClient.account?.address)
  // kernelClient.sendTransaction({
  //   to: kernelClient.account?.address!,
  //   data: '0x',
  //   chain: chain as Chain,
  //   account: signer as LocalAccount,
  // })
  // //conditionally deploys kernel account if it doesn't exist
  // await kernelClient.deployKernelAccount()

  // addExecutorToKernelAccount(kernelClient)
  return undefined as any
}

async function addExecutorToKernelAccount(client: KernelAccountClientWithoutBundler) {
  const multisigPublicAddress = client.account?.address!
  // Create the account object
  const account = getAccount({
    address: client.account?.address!,
    type: 'erc7579-implementation',
  })
  const executor = getOwnableExecutor({
    owner: multisigPublicAddress,
  })
  const installReceipt = await installModule({
    client: client as any,
    account: account,
    module: executor
  })

  console.log('installReceipt: ', installReceipt)
  await client.execute(installReceipt as any)
}

// export async function getKernelAccountClient<
//   entryPointVersion extends '0.7' = entryPointV_0_7,
//   owner extends OneOf<
//     EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
//   > = LocalAccount,
// >(
//   parameters: KernelAccountClientConfig<entryPointVersion, KernelVersion<entryPointVersion>, owner>,
// ): Promise<{ client: KernelAccountClient<entryPointVersion>; args: DeployFactoryArgs }> {
//   const { key = 'kernelAccountClient', name = 'Kernel Account Client', transport , chain} = parameters
//   const { account } = parameters

//   // let client = createWalletClient({
//   //   ...parameters,
//   //   account,
//   //   key,
//   //   name,
//   //   transport,
//   // }) as KernelAccountClient<entryPointVersion>

//   const kernelVersion = KERNEL_V3_1
//   const entryPoint = {
//     address: entryPoint07Address,
//     version: '0.7' as EntryPointVersion,
//   }

//   const publicClient = createPublicClient({
//     transport
//     chain,
//   })

//   const ecdsaValidator = await signerToEcdsaValidator(client, {
//     signer: account as LocalAccount,
//     entryPoint: entryPoint!,
//     kernelVersion
//   })

//   const kernelAccount = await createKernelAccount(client, {
//     plugins: {
//       sudo: ecdsaValidator,
//     },
//     useMetaFactory: false,
//     entryPoint: entryPoint as any,
//     kernelVersion,
//   })

//   // const kernelVersion = KERNEL_V3_1
//   // const kernelAccount = await toEcdsaKernelSmartAccount<
//   //   entryPointVersion,
//   //   KernelVersion<entryPointVersion>,
//   //   owner
//   // >({
//   //   ...parameters,
//   //   client,
//   // })
//   // const ecdsaValidator = await signerToEcdsaValidator(client, {
//   //   signer: account as LocalAccount,
//   //   entryPoint: parameters.entryPoint as any,
//   //   kernelVersion
//   // })

//   // const kernelAccount = await createKernelAccount(client, {
//   //   plugins: {
//   //     sudo: ecdsaValidator,
//   //     // regular: ecdsaValidator,
//   //   },
//   //   entryPoint: parameters.entryPoint as any,
//   //   kernelVersion,
//   //   address: zeroAddress
//   // })

//   // const kernelClient = createKernelAccountClientSdK({
//   //   account: kernelAccount,
//   //   chain: optimism,
//   //   bundlerTransport: transport
//   // })

//   // if (kernelAccount.address === zeroAddress) {
//   //   const { factoryData: factoryStakerData } = await kernelAccount.getFactoryArgs()

//   //   if (factoryStakerData) {
//   //     const { args } = decodeFunctionData({
//   //       abi: parseAbi([
//   //         'function deployWithFactory(address factory, bytes calldata createData, bytes32 salt) external payable returns (address)',
//   //       ]),
//   //       data: factoryStakerData,
//   //     })

//   //     const [factory, createdData, salt] = args

//   //     const publicClient = createPublicClient({
//   //       ...parameters,
//   //     })

//   //     const KernelFactoryABI = parseAbi([
//   //       'function getAddress(bytes calldata data, bytes32 salt) view returns (address)',
//   //     ])

//   //     const { data } = await publicClient.call({
//   //       to: factory,
//   //       data: encodeFunctionData({
//   //         functionName: 'getAddress',
//   //         abi: KernelFactoryABI,
//   //         args: [createdData, salt],
//   //       }),
//   //     })

//   //     const address = decodeFunctionResult({
//   //       abi: KernelFactoryABI,
//   //       functionName: 'getAddress',
//   //       data: data!,
//   //     })

//   //     kernelAccount.address = address as Hex
//   //   }
//   // }

//   client.kernelAccount = kernelAccount as any
//   client.kernelAccountAddress = kernelAccount.address
//   // client = client.extend(KernelAccountActions).extend(publicActions) as any
//   client = client.extend(kernelAccountClientActions())

//   //conditionally deploys kernel account if it doesn't exist
//   const args = await client.deployKernelAccount()

//   //add the executor to the kernel account
//   const multisigPublicAddress = (account as Account).address
//   // Create the account object
//   const accountKern = getAccount({
//     address: client.kernelAccountAddress,
//     type: 'erc7579-implementation',
//   })
//   const executor = getOwnableExecutor({
//     owner: multisigPublicAddress,
//   })
//   const installReceipt = await installModule({
//     client: client as any,
//     account: accountKern,
//     module: executor
//   })

//   console.log('installReceipt: ', installReceipt)
//   await client.execute(installReceipt as any) fffff
//   return { client, args }
// }
