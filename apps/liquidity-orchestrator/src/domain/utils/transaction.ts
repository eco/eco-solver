import { Address, encodeFunctionData, erc20Abi } from 'viem'

export const createApproveTransaction = (
  tokenAddress: Address,
  spenderAddress: Address,
  amount: bigint,
) => {
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spenderAddress, amount],
  })

  return {
    to: tokenAddress,
    data: approveData,
  }
}
