import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, ValidateNested } from 'class-validator'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { Type } from 'class-transformer'

export class PermitDataDTO {
  @IsOptional()
  @IsArray()
  @ValidateNested()
  @ApiPropertyOptional({
    description: 'Array of EIP-2612 permit signatures',
    type: [PermitDTO],
  })
  @Type(() => PermitDTO)
  permit?: PermitDTO[]

  @IsOptional()
  @IsArray()
  @ValidateNested()
  @ApiPropertyOptional({
    description: 'Array of Uniswap Permit2 signatures',
    type: [Permit2DTO],
  })
  @Type(() => Permit2DTO)
  permit2?: Permit2DTO[]

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional({
    description: 'Eco Protocol Permit3 multi-chain signature data',
    type: () => Permit3DTO,
  })
  @Type(() => Permit3DTO)
  permit3?: Permit3DTO
}
