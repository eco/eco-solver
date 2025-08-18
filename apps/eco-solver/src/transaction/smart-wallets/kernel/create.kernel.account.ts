import {
  Account,
  Chain,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  getAddress,
  Hex,
  LocalAccount,
  OneOf,
  publicActions,
  PublicClient,
  Transport,
  WalletClient,
} from 'viem'
import { KernelAccountClientConfig } from './kernel-account.config'
import {
  DeployFactoryArgs,
  KernelAccountActions,
  KernelAccountClient,
} from './kernel-account.client'
import { EthereumProvider } from 'permissionless/utils/toOwner'
import { KernelVersion } from 'permissionless/accounts'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createKernelAccount } from '@zerodev/sdk'
import {
  getAccount,
  getOwnableExecutor,
  GLOBAL_CONSTANTS,
  installModule,
  isModuleInstalled,
} from '@rhinestone/module-sdk'
import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { OwnableExecutorAbi } from '@eco-solver/contracts'
import { GetKernelVersion } from '@zerodev/sdk/types'

export type entryPointV_0_7 = '0.7'

/**
 * Creates a kernel account client with a kernel account.
 *
 * @param parameters the kernel account client config
 * @returns
 */
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

  let walletClient = createWalletClient({
    ...parameters,
    account,
    key,
    name,
    transport,
  }) as KernelAccountClient<entryPointVersion>
  const kernelVersion = KERNEL_V3_1 as GetKernelVersion<entryPointVersion>

  // Don't override the entryPoint address if it was provided by the caller!
  let entryPoint = parameters.entryPoint

  if (!entryPoint) {
    entryPoint = {
      address: entryPoint07Address,
      version: '0.7' as entryPointVersion,
    }
  }

  const ecdsaValidator = await signerToEcdsaValidator(walletClient, {
    signer: account as LocalAccount,
    entryPoint: entryPoint!,
    kernelVersion,
  })

  const kernelAccount = await createKernelAccount(walletClient as any as PublicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    useMetaFactory: false,
    entryPoint: entryPoint as any,
    kernelVersion,
  })

  walletClient.kernelAccount = kernelAccount as any
  walletClient.kernelAccountAddress = kernelAccount.address
  walletClient = walletClient.extend(KernelAccountActions).extend(publicActions) as any

  //conditionally deploys kernel account if it doesn't exist
  const args = await walletClient.deployKernelAccount()
  return { client: walletClient, args }
}

/**
 * Adds a {@link OwnableExecutor} module to the kernel account. The module is used to
 * execute transactions on behalf of the kernel account. Owner is usually
 * a multisig safe account.
 *
 * @param client the kernel account client
 * @param owner the owner to add to the kernel account, a multisig usually
 */
export async function addExecutorToKernelAccount<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7,
>(client: KernelAccountClient<entryPointVersion>, owner: Hex) {
  const logger = getLogger()

  // Ensure the owner is valid and checksummed
  owner = getAddress(owner)

  // Create the account object
  const account = getAccount({
    address: client.kernelAccount.address,
    type: 'kernel',
  })
  const executor = getOwnableExecutor({
    owner,
  })

  const executorInstalled = await isModuleInstalled({
    client: client as any,
    account: account,
    module: executor,
  })

  logger.log(
    EcoLogMessage.fromDefault({
      message: `isModuleInstalled OwnableExecutor: ${executorInstalled}`,
      properties: {
        kernelAccount: client.kernelAccount.address,
        owner,
      },
    }),
  )

  if (!executorInstalled) {
    logger.log(
      EcoLogMessage.fromDefault({
        message: `installing OwnableExecutor`,
        properties: {
          kernelAccount: client.kernelAccount.address,
          owner,
        },
      }),
    )
    const installExecutes = await installModule({
      client: client as any,
      account: account,
      module: executor,
    })

    try {
      const transactionHash = await client.execute(installExecutes as any)
      const receipt = await client.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: 5,
      })
      logger.log(
        EcoLogMessage.fromDefault({
          message: `installed OwnableExecutor`,
          properties: {
            kernelAccount: client.kernelAccount.address,
            owner,
            transactionHash,
            receipt,
          },
        }),
      )
    } catch (e) {
      // Clients do not cache, so an install can go through but the
      // client still tries to install it on a subsequent call
      logger.error(
        EcoLogMessage.fromDefault({
          message: `install OwnableExecutor failed`,
          properties: {
            kernelAccount: client.kernelAccount.address,
            owner,
            error: e,
          },
        }),
      )
    }
  }
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
