import { IsEthereumAddress, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { IndexerIntentDTO } from '@/indexer/interfaces/intent.interface'

class ClaimantDTO {
  @IsString()
  @IsNotEmpty()
  _hash: string

  @IsEthereumAddress()
  _claimant: string
}

export class BatchWithdrawsDTO {
  @ValidateNested()
  @Type(() => IndexerIntentDTO)
  intent: IndexerIntentDTO

  @ValidateNested()
  @Type(() => ClaimantDTO)
  claimant: ClaimantDTO
}
