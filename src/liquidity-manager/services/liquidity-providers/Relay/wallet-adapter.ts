import { Account, Chain, Hex, HttpTransport, publicActions } from 'viem'
import { AdaptedWallet } from '@reservoir0x/relay-sdk'
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient'

/**
 * Adapts a KernelAccountClient wallet to the Relay SDK's AdaptedWallet interface
 *
 * @param _kernelClient The KernelAccountClient instance to adapt
 * @param switchChainFn Optional function to handle chain switching
 * @returns An AdaptedWallet compatible with Relay SDK
 */
export const adaptKernelWallet = (
  _kernelClient: KernelAccountClient,
  switchChainFn: (chainId: number) => Promise<KernelAccountClient>,
): AdaptedWallet => {
  let kernelClient = _kernelClient

  return {
    // Specify VM type as EVM
    vmType: 'evm',

    // Get chain ID from the client's chain
    getChainId: async () => {
      return kernelClient.chain!.id
    },

    // Pass through the transport from the kernel client
    transport: kernelClient.transport as unknown as HttpTransport,

    // Get the wallet address
    address: async () => {
      return kernelClient.account?.address as Hex
    },

    // Handle message signing - always throw an error as requested
    handleSignMessageStep: async () => {
      throw new Error('Message signing not supported for KernelAccountClient')
    },

    // Handle transaction sending
    handleSendTransactionStep: async (chainId, stepItem) => {
      const { data: transaction } = stepItem
      return kernelClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
        gas: transaction.gas ? BigInt(transaction.gas) : undefined,
        maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
          ? BigInt(transaction.maxPriorityFeePerGas)
          : undefined,
        account: kernelClient.account as Account,
        chain: kernelClient.chain as Chain,
      })
    },

    // Handle transaction confirmation
    handleConfirmTransactionStep: async (hash, chainId, onReplaced, onCancelled) => {
      const client =
        kernelClient.chain?.id === chainId ? kernelClient : await switchChainFn(chainId)

      // Wait for transaction receipt
      return client.extend(publicActions).waitForTransactionReceipt({
        hash: hash as Hex,
        confirmations: 1,
        timeout: 60_000,
        onReplaced: (replacement) => {
          if (replacement.reason === 'cancelled') {
            onCancelled()
            throw Error('Transaction cancelled')
          }
          onReplaced(replacement.transaction.hash)
        },
      })
    },

    // Use provided switchChain function or throw error
    switchChain: async (chainId) => {
      kernelClient = await switchChainFn(chainId)
    },

    // Check if batch transactions are supported
    supportsAtomicBatch: () => Promise.resolve(false),
  }
}
