import { ApiPropertyOptional } from '@nestjs/swagger'
import { BatchPermitDataDTO } from '@/quote/dto/permit2/batch-permit-data.dto'
import { Hex } from 'viem'
import { IsOptional, ValidateNested } from 'class-validator'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'
import { SinglePermitDataDTO } from '@/quote/dto/permit2/single-permit-data.dto'
import { Type } from 'class-transformer'

export class Permit2DataDTO {
  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => SinglePermitDataDTO)
  singlePermitData?: SinglePermitDataDTO

  @IsOptional()
  @ValidateNested()
  @ApiPropertyOptional()
  @Type(() => BatchPermitDataDTO)
  batchPermitData?: BatchPermitDataDTO

  getDetails(): Permit2TypedDataDetailsDTO[] {
    if (this.singlePermitData) {
      return [this.singlePermitData.typedData.details]
    }

    return this.batchPermitData!.typedData.details
  }

  getSpender(): Hex {
    if (this.singlePermitData) {
      return this.singlePermitData.typedData.spender
    }

    return this.batchPermitData!.typedData.spender
  }

  getSigDeadline(): string {
    if (this.singlePermitData) {
      return this.singlePermitData.typedData.sigDeadline
    }

    return this.batchPermitData!.typedData.sigDeadline
  }
}
