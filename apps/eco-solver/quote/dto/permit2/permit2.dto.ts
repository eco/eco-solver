import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Permit2DataDTO } from '@/quote/dto/permit2/permit2-data.dto'
import { Type } from 'class-transformer'

export class Permit2DTO {
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  permitContract!: Hex

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => Permit2DataDTO)
  permitData!: Permit2DataDTO // SinglePermitData | BatchPermitData permit2 data required for permit call to the permit2 contract

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  signature!: Hex // signed permit2 data
}
