import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsEthereumAddress, IsInt, IsNotEmpty, Matches } from 'class-validator'
import { Transform } from 'class-transformer'

export class AllowanceOrTransferDTO {
  @IsInt()
  @ApiProperty({
    description: 'The chain ID where the allowance or transfer occurs',
    example: 1,
  })
  chainID: number

  @IsInt()
  @ApiProperty({
    description: 'Mode for transfer (0) or expiration timestamp for allowance update',
    example: 0,
  })
  modeOrExpiration: number

  @IsNotEmpty()
  @Matches(/^0x[0-9a-fA-F]{64}$/, {
    message: 'tokenKey must be a valid bytes32 string',
  })
  @ApiProperty({
    description: 'Encoded tokenKey (ERC20: padded address, NFT: hash of token + tokenId)',
    example: '0x000000000000000000000000a0b86a33e6441b8ec2c8c7e5b0d77d5fdda0c4e4',
  })
  tokenKey: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty({
    description: 'Account address receiving the allowance or transfer',
    example: '0x742d35cc6634c0532925a3b8b0eff6a2db3b51a',
  })
  account: Hex

  @IsNotEmpty()
  @ApiProperty({
    description: 'Amount delta for the allowance or transfer (in wei)',
    example: '1000000000000000000',
  })
  @Transform(({ value }) => BigInt(value))
  amountDelta: bigint
}
// export class AllowanceOrTransferDTO {
//   @IsInt()
//   @ApiProperty({
//     description: 'The chain ID where the allowance or transfer occurs',
//     example: 1,
//   })
//   chainID: number // The original chain ID from the signature

//   @IsInt()
//   @ApiProperty({
//     description: 'Mode for allowance (0) or expiration timestamp for transfer',
//     example: 0,
//   })
//   modeOrExpiration: number

//   @IsNotEmpty()
//   @IsEthereumAddress()
//   @ApiProperty({
//     description: 'Token contract address',
//     example: '0xA0b86a33E6441B8Ec2c8C7E5b0d77D5FdDa0c4E4',
//   })
//   token: Hex

//   @IsNotEmpty()
//   @IsEthereumAddress()
//   @ApiProperty({
//     description: 'Account address for the allowance or transfer',
//     example: '0x742d35cc6634c0532925a3b8b0eff6a2db3b51a',
//   })
//   account: Hex

//   @IsNotEmpty()
//   @ApiProperty({
//     description: 'Amount delta for the allowance or transfer (in wei)',
//     example: 1000000000000000000,
//   })
//   @Transform(({ value }) => BigInt(value))
//   amountDelta: bigint
// }
