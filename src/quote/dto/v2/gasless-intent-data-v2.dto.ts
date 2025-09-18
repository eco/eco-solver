import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator'
import { Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { Type } from 'class-transformer'

export class GaslessIntentDataV2DTO {
  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty({
    description: 'Permit3 signature data for multi-chain token approvals',
    type: () => Permit3DTO,
  })
  @Type(() => Permit3DTO)
  permit3: Permit3DTO

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether to allow partial funding of the intent',
    example: false,
    default: false,
  })
  allowPartial?: boolean = false
}
