import { encodeAbiParameters, encodeFunctionData, encodePacked, Hex, pad, PublicClient } from 'viem'
import { HyperlaneMailboxAbi, MessageRecipientAbi } from '@/contracts/HyperlaneMailbox'
import * as chainMetadata from '@/common/hyperlane/chainMetadata.json'
import * as chainAddresses from '@/common/hyperlane/chainAddresses.json'

export async function estimateMessageGas(
  publicClient: PublicClient,
  mailboxAddr: Hex,
  handlerAddr: Hex,
  origin: number,
  sender: Hex,
  message: Hex,
): Promise<bigint> {
  const transactionGas = await publicClient.estimateGas({
    account: mailboxAddr,
    to: handlerAddr,
    data: encodeFunctionData({
      abi: MessageRecipientAbi,
      args: [origin, pad(sender), message],
    }),
  })

  // Since it's an internal call, the transaction initiation gas shouldn't be included
  // Also add a 10% buffer
  return ((transactionGas - 21_000n) * 110n) / 100n
}

export async function estimateFee(
  publicClient: PublicClient,
  mailboxAddr: Hex,
  destination: number,
  recipient: Hex,
  messageBody: Hex,
  metadata: Hex,
  hook: Hex,
): Promise<bigint> {
  return publicClient.readContract({
    address: mailboxAddr,
    abi: HyperlaneMailboxAbi,
    functionName: 'quoteDispatch',
    args: [destination, pad(recipient), messageBody, metadata, hook],
  })
}

export function getContracts(chainId: number) {
  const { name } = getChainMetadata(chainId)
  const { mailbox, interchainGasPaymaster } = chainAddresses[name] as {
    mailbox: Hex
    interchainGasPaymaster: Hex
  }
  return { mailbox, interchainGasPaymaster }
}

export function getChainMetadata(chainId: number) {
  const chain = Object.values(chainMetadata).find((chain) => chain.chainId === chainId)

  if (!chain) throw new Error(`Unable to get hyperlane chain (${chainId})`)

  return chain
}

export function getMessageData(claimant: Hex, hashes: Hex[]) {
  const claimants = new Array<Hex>(hashes.length).fill(claimant)
  return encodeAbiParameters([{ type: 'bytes32[]' }, { type: 'address[]' }], [hashes, claimants])
}

export function getMetadata(value: bigint, gasLimit: bigint) {
  return encodePacked(['uint16', 'uint256', 'uint256'], [1, value, gasLimit])
}

export async function getDefaultHook(publicClient: PublicClient, mailbox: Hex) {
  return publicClient.readContract({
    abi: HyperlaneMailboxAbi,
    address: mailbox,
    functionName: 'defaultHook',
  })
}
