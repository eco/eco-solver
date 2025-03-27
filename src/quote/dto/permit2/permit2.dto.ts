import { ApiProperty } from '@nestjs/swagger'
import { IsEthereumAddress, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Permit2DataDTO } from './permit2-data.dto'
import { Type } from 'class-transformer'

export class Permit2DTO {
  @ApiProperty()
  @IsNotEmpty()
  permitType: string

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  permitContract: string

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2DataDTO)
  permitData: Permit2DataDTO // SinglePermitData | BatchPermitData permit2 data required for permit call to the permit2 contract

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature: string // signed permit2 data
}
