import { ApiProperty } from '@nestjs/swagger'
import { Hex } from 'viem'
import { IsEthereumAddress, IsNotEmpty, ValidateNested } from 'class-validator'
import { PermitSignatureDTO } from './permit-signature-data.dto'
import { Type } from 'class-transformer'

export class PermitDTO {
  // one for each rewardToken in the intent
  @IsNotEmpty()
  @IsEthereumAddress()
  @ApiProperty()
  token: Hex // permit supported ERC20 to call 'permit' on, also the reward token to match up with

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => PermitSignatureDTO)
  data: PermitSignatureDTO
}
