import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsEthereumAddress, IsInt, IsNotEmpty } from 'class-validator'
import { Transform } from 'class-transformer'

export class AllowanceOrTransferDTO {
  @IsInt()
  @ApiProperty({
    description: 'The chain ID where the allowance or transfer occurs',
    example: 1,
  })
  chainID: number // The original chain ID from the signature

  @IsInt()
  @ApiProperty({
    description: 'Mode for allowance (0) or expiration timestamp for transfer',
    example: 0,
  })
  modeOrExpiration: number

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty({
    description: 'Token contract address',
    example: '0xA0b86a33E6441B8Ec2c8C7E5b0d77D5FdDa0c4E4',
  })
  token: Hex

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty({
    description: 'Account address for the allowance or transfer',
    example: '0x742d35cc6634c0532925a3b8b0eff6a2db3b51a',
  })
  account: Hex

  @IsNotEmpty()
  @ApiProperty({
    description: 'Amount delta for the allowance or transfer (in wei)',
    example: 1000000000000000000,
  })
  @Transform(({ value }) => BigInt(value))
  amountDelta: bigint
}
