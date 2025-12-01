import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator'
import { PermitDataDTO } from '@/quote/dto/permit-data.dto'
import { Type } from 'class-transformer'

export class GaslessIntentDataDTO {
  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional({
    description: 'Permit signatures for token approvals (Permit, Permit2, or Permit3)',
    type: () => PermitDataDTO,
  })
  @Type(() => PermitDataDTO)
  permitData?: PermitDataDTO

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether to allow partial fulfillment of the intent',
    example: false,
  })
  allowPartial?: boolean = false
}
