import { QuoteRewardDataDTO, QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNotEmpty, ValidateNested } from 'class-validator'

/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export class QuoteIntentDataDTO implements QuoteIntentDataInterface {
  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRouteDataDTO)
  route: QuoteRouteDataDTO

  @IsNotEmpty()
  @ApiProperty()
  @ValidateNested()
  @Type(() => QuoteRewardDataDTO)
  reward: QuoteRewardDataDTO

  toQuoteIntentModel(): QuoteIntentModel {
    const model = new QuoteIntentModel()
    model.route = {
      source: this.route.source,
      destination: this.route.destination,
      inbox: this.route.inbox,
      calls: this.route.calls.map((call) => ({
        target: call.target,
        data: call.data,
        value: call.value,
      })),
    }
    model.reward = {
      prover: this.reward.prover,
      deadline: this.reward.deadline,
      nativeValue: this.reward.nativeValue,
      tokens: this.reward.tokens.map((token) => ({
        token: token.token,
        amount: token.amount,
      })),
    }
    return model
  }
}

export interface QuoteIntentDataInterface {
  route: QuoteRouteDataInterface
  reward: QuoteRewardDataType
}
