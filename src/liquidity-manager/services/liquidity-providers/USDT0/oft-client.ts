import { Hex, encodeFunctionData, pad } from 'viem'
import { oftV2Abi, erc20ApproveAbi } from './constants/abis'

export type SendParam = {
  dstEid: number
  to: Hex // 32-byte padded
  amountLD: bigint
  minAmountLD: bigint
  extraOptions?: Hex
  composeMsg?: Hex
  oftCmd?: Hex
}

export function toBytes32Address(addr: Hex): Hex {
  return pad(addr, { size: 32 })
}

export function buildQuoteOFTCalldata(param: SendParam): Hex {
  return encodeFunctionData({
    abi: oftV2Abi,
    functionName: 'quoteOFT',
    args: [
      {
        dstEid: param.dstEid,
        to: param.to,
        amountLD: param.amountLD,
        minAmountLD: param.minAmountLD,
        extraOptions: param.extraOptions ?? ('0x' as Hex),
        composeMsg: param.composeMsg ?? ('0x' as Hex),
        oftCmd: param.oftCmd ?? ('0x' as Hex),
      },
    ],
  })
}

export function buildQuoteSendCalldata(param: SendParam, payInLzToken = false): Hex {
  return encodeFunctionData({
    abi: oftV2Abi,
    functionName: 'quoteSend',
    args: [
      {
        dstEid: param.dstEid,
        to: param.to,
        amountLD: param.amountLD,
        minAmountLD: param.minAmountLD,
        extraOptions: param.extraOptions ?? ('0x' as Hex),
        composeMsg: param.composeMsg ?? ('0x' as Hex),
        oftCmd: param.oftCmd ?? ('0x' as Hex),
      },
      payInLzToken,
    ],
  })
}

export function buildSendCalldata(param: SendParam, nativeFee: bigint, refundAddress: Hex): Hex {
  return encodeFunctionData({
    abi: oftV2Abi,
    functionName: 'send',
    args: [
      {
        dstEid: param.dstEid,
        to: param.to,
        amountLD: param.amountLD,
        minAmountLD: param.minAmountLD,
        extraOptions: param.extraOptions ?? ('0x' as Hex),
        composeMsg: param.composeMsg ?? ('0x' as Hex),
        oftCmd: param.oftCmd ?? ('0x' as Hex),
      },
      { nativeFee, lzTokenFee: 0n },
      refundAddress,
    ],
  })
}

export function buildApproveCalldata(spender: Hex, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [spender, amount],
  })
}
