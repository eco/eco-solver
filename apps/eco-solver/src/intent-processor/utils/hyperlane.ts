import { encodeAbiParameters, encodeFunctionData, encodePacked, pad, PublicClient } from 'viem'
import { Hex } from 'viem'
import { HyperlaneMailboxAbi, MessageRecipientAbi } from '@eco-solver/contracts/HyperlaneMailbox'
import { HyperlaneConfig } from '@libs/eco-solver-config'

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

export function getChainMetadata(hyperlaneConfig: HyperlaneConfig, chainId: number) {
  const chain = hyperlaneConfig.chains[chainId.toString()]
  if (!chain) throw new Error(`Hyperlane config not found for chain id ${chainId}`)
  return chain
}

export function getMessageData(claimant: Hex, hashes: Hex[]) {
  const claimants = new Array<Hex>(hashes.length).fill(claimant)
  return encodeAbiParameters([{ type: 'bytes32[]' }, { type: 'address[]' }], [hashes, claimants])
}

export function getMetadata(value: bigint, gasLimit: bigint) {
  return encodePacked(['uint16', 'uint256', 'uint256'], [1, value, gasLimit])
}
