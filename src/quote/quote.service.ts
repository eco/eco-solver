import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RewardTokensInterface } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeasibilityService } from '@/intent/feasibility.service'
import { someFailedValidations, ValidationService } from '@/intent/validation.sevice'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import {
  InfeasibleQuote,
  InternalSaveError,
  InvalidQuote,
  Quote400,
  SolverUnsupported,
} from '@/quote/errors'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

/**
 * The response quote data
 */
export interface QuoteData {
  tokens: RewardTokensInterface[]
  expiryTime: string
}

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly liquidityService: LiquidityManagerService,
    private readonly validationService: ValidationService,
    private readonly feasibilityService: FeasibilityService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onApplicationBootstrap() {}

  async getQuote(quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Getting quote for intent`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    // Fire it off, but dont wait for it to store the quote intent data
    const quoteIntent = await this.storeQuoteIntentData(quoteIntentDataDTO)
    if (quoteIntent instanceof Error) {
      return InternalSaveError(quoteIntent)
    }
    const res = await this.validateQuoteIntentData(quoteIntent)
    if (res) {
      return res
    }

    return await this.generateQuote(quoteIntent)
  }

  async storeQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<QuoteIntentModel | Error> {
    try {
      const record = await this.quoteIntentModel.create(quoteIntentDataDTO)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Recorded quote intent`,
          properties: {
            record,
          },
        }),
      )
      return record
    } catch (e) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in storeQuoteIntentData`,
          properties: {
            quoteIntentDataDTO,
            error: e,
          },
        }),
      )
      return e
    }
  }

  async validateQuoteIntentData(quoteIntentModel: QuoteIntentModel): Promise<Quote400 | undefined> {
    const solver = this.ecoConfigService.getSolver(quoteIntentModel.route.destination)
    if (!solver) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: No solver found for destination : ${quoteIntentModel.route.destination}`,
          properties: {
            quoteIntentModel,
          },
        }),
      )
      //todo save to db
      return SolverUnsupported
    }

    const validations = await this.validationService.assertValidations(quoteIntentModel, solver)
    if (someFailedValidations(validations)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: Some validations failed`,
          properties: {
            quoteIntentModel,
            validations,
          },
        }),
      )
      //todo save to db
      return InvalidQuote(validations)
    }

    const { feasable, results } = await this.feasibilityService.validateExecution(
      quoteIntentModel,
      solver,
    )
    //todo save to db with results
    if (!feasable) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: quote intent is not feasable ${quoteIntentModel._id}`,
          properties: {
            feasable,
            quoteIntentModel,
          },
        }),
      )

      return InfeasibleQuote(results)
    }

    return
  }

  async generateQuote(quoteIntentModel: QuoteIntentModel) {
    const chainID = quoteIntentModel.route.destination
    const quote: QuoteData = {
      tokens: [],
      expiryTime: '',
    }

    const { deficit, surplus, items } = await this.liquidityService.analyzeTokens()
    const source = this.ecoConfigService
      .getIntentSources()
      .find((intent) => BigInt(intent.chainID) == quoteIntentModel.route.destination)
    if (!source) {
      return
    }
    const acceptedTokens = source.tokens
    let sum = 0n
    const deficitUnionTokens = deficit.items.filter((d) =>
      acceptedTokens.includes(d.config.address),
    )
    const surplusUnionTokens = surplus.items.filter((d) =>
      acceptedTokens.includes(d.config.address),
    )
    const unionTokens = deficit.items.filter((d) => acceptedTokens.includes(d.config.address))
    if (deficit.total > 0) {
      const unionTokens = deficit.items.filter((d) => acceptedTokens.includes(d.config.address))
      unionTokens.forEach((token) => {
        sum += this.feasibilityService.convertToUSDC(chainID, {
          amount: token.balance,
          token: token.config.address,
        })
      })
    }
  }
}
