import { randomBytes } from 'node:crypto'
import type { Account } from 'viem'
import { Address, Hex, maxUint256, pad, zeroAddress } from 'viem'
import { usdcAddresses, gatewayDomains, gatewayWalletAddress, gatewayMinterAddress } from '../setup'

interface BurnIntentParams {
  account: Account
  fromChainId: number
  toChainId: number
  amount: bigint
  recipient?: Address
}

interface TransferSpec {
  version: number
  sourceDomain: number
  destinationDomain: number
  sourceContract: Hex
  destinationContract: Hex
  sourceToken: Hex
  destinationToken: Hex
  sourceDepositor: Hex
  destinationRecipient: Hex
  sourceSigner: Hex
  destinationCaller: Hex
  value: bigint
  salt: Hex
  hookData: Hex
}

interface BurnIntent {
  maxBlockHeight: bigint
  maxFee: bigint
  spec: TransferSpec
}

const domain = { name: 'GatewayWallet', version: '1' } as const

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
] as const

const TransferSpec = [
  { name: 'version', type: 'uint32' },
  { name: 'sourceDomain', type: 'uint32' },
  { name: 'destinationDomain', type: 'uint32' },
  { name: 'sourceContract', type: 'bytes32' },
  { name: 'destinationContract', type: 'bytes32' },
  { name: 'sourceToken', type: 'bytes32' },
  { name: 'destinationToken', type: 'bytes32' },
  { name: 'sourceDepositor', type: 'bytes32' },
  { name: 'destinationRecipient', type: 'bytes32' },
  { name: 'sourceSigner', type: 'bytes32' },
  { name: 'destinationCaller', type: 'bytes32' },
  { name: 'value', type: 'uint256' },
  { name: 'salt', type: 'bytes32' },
  { name: 'hookData', type: 'bytes' },
] as const

const BurnIntent = [
  { name: 'maxBlockHeight', type: 'uint256' },
  { name: 'maxFee', type: 'uint256' },
  { name: 'spec', type: 'TransferSpec' },
] as const

function addressToBytes32(address: Address): Hex {
  return pad(address, { size: 32 })
}

export function burnIntent({ account, fromChainId, toChainId, amount, recipient }: BurnIntentParams): BurnIntent {
  return {
    // Needs to be at least 7 days in the future
    maxBlockHeight: maxUint256,
    // 1.01 USDC will cover the fee for any chain. In the future, there will be an estimation endpoint for this purpose.
    maxFee: 1_010000n,
    spec: {
      version: 1,
      sourceDomain: gatewayDomains[fromChainId],
      destinationDomain: gatewayDomains[toChainId],
      sourceContract: gatewayWalletAddress,
      destinationContract: gatewayMinterAddress,
      sourceToken: usdcAddresses[fromChainId],
      destinationToken: usdcAddresses[toChainId],
      sourceDepositor: account.address,
      destinationRecipient: recipient || account.address,
      sourceSigner: account.address,
      destinationCaller: zeroAddress,
      value: amount,
      salt: ('0x' + randomBytes(32).toString('hex')) as Hex,
      hookData: '0x' as Hex,
    },
  }
}

export function burnIntentTypedData(burnIntent: BurnIntent) {
  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain,
    primaryType: 'BurnIntent',
    message: {
      ...burnIntent,
      spec: {
        ...burnIntent.spec,
        sourceContract: addressToBytes32(burnIntent.spec.sourceContract),
        destinationContract: addressToBytes32(burnIntent.spec.destinationContract),
        sourceToken: addressToBytes32(burnIntent.spec.sourceToken),
        destinationToken: addressToBytes32(burnIntent.spec.destinationToken),
        sourceDepositor: addressToBytes32(burnIntent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(burnIntent.spec.destinationRecipient),
        sourceSigner: addressToBytes32(burnIntent.spec.sourceSigner),
        destinationCaller: addressToBytes32(burnIntent.spec.destinationCaller ?? zeroAddress),
      },
    },
  } as const
}

export type { BurnIntent, TransferSpec }