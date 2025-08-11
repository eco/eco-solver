export function privateKeyAndNonceToAccountSigner(
  atomicNonceSource: NonceManagerSource,
  privateKey: Hex,
): PrivateKeyAccount {
  const nonceManager = createNonceManager({
    source: atomicNonceSource,
  })
  return privateKeyToAccount(privateKey, { nonceManager })
}

export function getAtomicNonceKey(params: AtomicKeyParams) {
  return `${params.address}.${params.chainId}`
}

export function getAtomicNonceVals(key: string): AtomicKeyParams {
  const [address, chainId] = key.split('.')
  return { address: address as Hex, chainId: parseInt(chainId) }
}
