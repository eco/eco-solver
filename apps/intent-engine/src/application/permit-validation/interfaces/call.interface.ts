export interface Call {
  address: Address
  abi: Abi
  functionName: string
  args: unknown[]
  account?: Address
}
