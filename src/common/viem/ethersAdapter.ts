import { ethers } from 'ethers'
import { AccessList, Hex, toHex } from 'viem'
import { KernelAccountClientV2 } from '@/transaction/smart-wallets/kernel/create-kernel-client-v2.account'

export function toEthersSigner(client: KernelAccountClientV2<'0.7'>): ethers.Signer {
  const account = client.account

  class ViemAdapterSigner extends ethers.AbstractSigner<ethers.JsonRpcProvider> {
    override provider: ethers.JsonRpcProvider
    private address: string

    constructor(provider: ethers.JsonRpcProvider, address: string) {
      super(provider)
      this.address = address
      this.provider = provider
    }

    override async getAddress(): Promise<string> {
      // needs to be a promise because ethers6 returns a promise
      return this.address
    }

    override connect(): ethers.Signer {
      return this
    }

    override async sendTransaction(
      tx: ethers.TransactionRequest,
    ): Promise<ethers.TransactionResponse> {
      if (!account) {
        throw new Error('Account not found')
      }
      const { to, data, value, gas } = await alignTxFromEthers({ tx })
      const transactionHash = await client.sendTransaction({ to, data, value })

      const txResponseParams: ethers.TransactionResponseParams = {
        blockHash: null,
        from: this.address,
        hash: transactionHash,
        blockNumber: null,
        index: 0,
        gasLimit: gas as bigint,
        // @ts-expect-error - we don't have this reliably so we'll just not include it
        signature: null,
      }

      return new ethers.TransactionResponse(txResponseParams, this.provider)
    }

    override async signTransaction(): Promise<string> {
      throw new Error('Function not implemented')
    }

    override signMessage(message: string | Uint8Array): Promise<string> {
      if (!account?.signMessage) {
        throw new Error('Account not found')
      }
      return account.signMessage({
        message: typeof message === 'string' ? message : { raw: message },
      })
    }

    override signTypedData(
      domain: ethers.TypedDataDomain,
      types: Record<string, ethers.TypedDataField[]>,
      // biome-ignore lint/suspicious/noExplicitAny: TODO: fix later
      value: Record<string, any>,
    ): Promise<string> {
      if (!account?.signTypedData) {
        throw new Error('Account not found')
      }
      const typedDataEncoder = new ethers.TypedDataEncoder(types)

      const typedData = {
        primaryType: typedDataEncoder.primaryType,
        domain: {
          chainId: domain.chainId ? bigNumberIshToNumber(domain.chainId) : undefined,
          name: domain.name ?? undefined,
          salt: domain.salt ? toHex(domain.salt) : undefined,
          verifyingContract: (domain.verifyingContract as Hex) ?? undefined,
          version: domain.version ?? undefined,
        },
        types,
        message: value,
      }

      return account.signTypedData(typedData)
    }
  }

  const provider = new ethers.JsonRpcProvider(client.chain.rpcUrls.default.http[0], client.chain.id)

  return new ViemAdapterSigner(provider, account.address)
}

async function alignTxFromEthers(options: { tx: ethers.TransactionRequest }) {
  const { tx } = options
  const {
    type: ethersType,
    accessList,
    chainId: ethersChainId,
    to: ethersTo,
    data,
    nonce,
    value,
    gasPrice,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  } = tx
  let chainId: number | undefined
  if (ethersChainId) {
    chainId = Number(ethersChainId)
  }

  const to = await resolveEthers6Address(ethersTo)

  // massage "type" to fit ethers
  switch (ethersType) {
    case 1: {
      if (!chainId) {
        throw new Error('ChainId is required for EIP-2930 transactions')
      }
      return {
        accessList: accessList as AccessList,
        to: to ?? undefined,
        data: (data ?? undefined) as Hex | undefined,
        gasPrice: gasPrice ? bigNumberIshToBigint(gasPrice) : undefined,
        gas: gasLimit ? bigNumberIshToBigint(gasLimit) : undefined,
        nonce: nonce ?? undefined,
        value: value ? bigNumberIshToBigint(value) : undefined,
      }
    }
    case 2: {
      if (!chainId) {
        throw new Error('ChainId is required for EIP-1559 transactions')
      }
      return {
        accessList: accessList as AccessList,
        to: (to ?? undefined) as Hex | undefined,
        data: (data ?? undefined) as Hex | undefined,
        gas: gasLimit ? bigNumberIshToBigint(gasLimit) : undefined,
        nonce: nonce ?? undefined,
        value: value ? bigNumberIshToBigint(value) : undefined,
        maxFeePerGas: maxFeePerGas ? bigNumberIshToBigint(maxFeePerGas) : undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas
          ? bigNumberIshToBigint(maxPriorityFeePerGas)
          : undefined,
      }
    }
    default: {
      // fall back to legacy
      return {
        to: (to ?? undefined) as Hex | undefined,
        data: (data ?? undefined) as Hex | undefined,
        nonce: nonce ?? undefined,
        value: value ? bigNumberIshToBigint(value) : undefined,
        gasPrice: gasPrice ? bigNumberIshToBigint(gasPrice) : undefined,
        gas: gasLimit ? bigNumberIshToBigint(gasLimit) : undefined,
      }
    }
  }
}

async function resolveEthers6Address(
  address: ethers.AddressLike | null | undefined,
): Promise<Hex | undefined> {
  if (!address) return undefined
  const resolvedAddress = await address
  if (typeof resolvedAddress === 'string') return resolvedAddress as Hex
  return (await resolvedAddress?.getAddress()) as Hex
}

function bigNumberIshToBigint(value: ethers.BigNumberish): bigint {
  if (typeof value === 'bigint') {
    return value
  }
  return BigInt(value)
}

function bigNumberIshToNumber(value: ethers.BigNumberish): number {
  return Number(bigNumberIshToBigint(value))
}
