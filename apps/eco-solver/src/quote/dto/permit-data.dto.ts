import { ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator'
import { Hex } from 'viem'
import { Permit2DTO } from './permit2/permit2.dto'
import { PermitDTO } from './permit/permit.dto'
import { Type } from 'class-transformer'
import { zeroAddress } from 'viem'

export class PermitDataDTO {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => PermitDTO)
  permit?: PermitDTO[]

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => Permit2DTO)
  permit2?: Permit2DTO

  getPermitContractAddress?(): Hex {
    return (this.permit ? zeroAddress : this.permit2!.permitContract) as Hex
  }
}
