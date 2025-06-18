import { type Account, type Chain, type Transport, type WalletClient } from 'viem'
import { providers } from 'ethers'

export function walletClientToSigner(
  walletClient: WalletClient<Transport, Chain | undefined, Account | undefined>,
): providers.JsonRpcSigner {
  const { account, chain } = walletClient

  if (!account) {
    throw new Error('Wallet client is not connected to an account')
  }
  if (!chain) {
    throw new Error('Wallet client is not connected to a chain')
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new providers.Web3Provider(walletClient as any, network)
  const signer = provider.getSigner(account.address)
  return signer
}
