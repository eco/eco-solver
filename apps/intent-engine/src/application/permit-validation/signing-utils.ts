const ERC20PermitAbiWithVersion = [
  ...ERC20Abi,
  {
    type: 'function',
    name: 'version',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const

export interface Eip712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: Address
}

export async function getEip712DomainFromToken(
  client: PublicClient,
  tokenAddress: Address,
): Promise<Eip712Domain> {
  const chainId = await client.getChainId()

  const name = await client.readContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: 'name',
  })

  let version = '1'

  try {
    const value = await client.readContract({
      address: tokenAddress,
      abi: ERC20PermitAbiWithVersion,
      functionName: 'version',
    })

    version = value.toString()
  } catch {}

  return {
    name,
    version,
    chainId,
    verifyingContract: tokenAddress,
  }
}
