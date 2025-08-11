export class GaslessIntentRequestDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  quoteID: string

  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  dAppID: string

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  salt: Hex

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  route: QuoteRouteDataDTO

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => QuoteRewardDataDTO)
  reward: QuoteRewardDataDTO

  @IsNotEmpty()
  @ValidateNested()
  @ApiProperty()
  @Type(() => GaslessIntentDataDTO)
  gaslessIntentData: GaslessIntentDataDTO

  getSourceChainID?(): number {
    return Number(this.route.source)
  }

  getFunder?(): Hex {
    return this.gaslessIntentData.funder
  }

  getPermitContractAddress?(): Hex {
    return this.gaslessIntentData.getPermitContractAddress?.() as Hex
  }

  static fromJSON(json: any): GaslessIntentRequestDTO {
    return json.getFunder ? json : plainToInstance(GaslessIntentRequestDTO, json)
  }
}
