import { Hex } from 'viem'
import { IsEthereumAddress, IsInt, IsString } from 'class-validator'

export class SendBatchDataDTO {
  @IsString()
  hash: Hex

  @IsInt()
  chainId: number

  @IsString()
  intentCreatedTxHash: Hex

  @IsInt()
  destinationChainId: number

  @IsEthereumAddress()
  intentSourceAddr: Hex

  @IsEthereumAddress()
  prover: Hex

  @IsEthereumAddress()
  claimant: Hex
}
