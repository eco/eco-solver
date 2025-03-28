import { ApiProperty } from '@nestjs/swagger'
import { IsEthereumAddress, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { PermitSignatureDTO } from './permit-signature-data.dto'
import { Type } from 'class-transformer'

export class PermitDTO {
  // one for each rewardToken in the intent
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  permitType: string

  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: string // permit supported ERC20 to call 'permit' on, also the reward token to match up with

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => PermitSignatureDTO)
  data: PermitSignatureDTO
}
