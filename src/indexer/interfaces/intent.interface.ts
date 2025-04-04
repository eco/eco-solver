import {
  IsArray,
  IsEthereumAddress,
  IsNotEmpty,
  IsNumberString,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { Hex } from 'viem'

class TokenAmountDTO {
  @IsEthereumAddress()
  token: Hex

  @IsString()
  @IsNotEmpty()
  amount: string
}

class CallDTO {
  @IsEthereumAddress()
  target: Hex

  @IsString()
  @IsNotEmpty()
  data: string

  @IsString()
  @IsNotEmpty()
  value: string
}

export class IndexerIntentDTO {
  @IsString()
  @IsNotEmpty()
  hash: Hex

  @IsEthereumAddress()
  creator: Hex

  @IsEthereumAddress()
  prover: Hex

  @IsString()
  @IsNotEmpty()
  salt: Hex

  @IsNumberString()
  source: string

  @IsNumberString()
  destination: string

  @IsEthereumAddress()
  inbox: Hex

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenAmountDTO)
  routeTokens: TokenAmountDTO[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallDTO)
  calls: CallDTO[]

  @IsString()
  @IsNotEmpty()
  deadline: string

  @IsString()
  @IsNotEmpty()
  nativeValue: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenAmountDTO)
  rewardTokens: TokenAmountDTO[]
}
