import { EcoLogMessage } from '@eco/infrastructure-logging'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentFundedEventModel } from '@eco/infrastructure-database'
import { IntentFundedLog } from '@/contracts'
import { Model } from 'mongoose'

/**
 * IntentFundedEventRepository is responsible for interacting with the database to store and fetch
 * intent funded event data.
 */
@Injectable()
export class IntentFundedEventRepository {
  private logger = new Logger(IntentFundedEventRepository.name)

  constructor(
    @InjectModel(IntentFundedEventModel.name) private model: Model<IntentFundedEventModel>,
  ) {}

  async addEvent(
    addIntentFundedEvent: IntentFundedLog,
  ): Promise<EcoResponse<IntentFundedEventModel>> {
    try {
      const intentFundedEventModel = await this.model.create(addIntentFundedEvent)
      return { response: intentFundedEventModel }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in addEvent`,
          properties: {
            addIntentFundedEvent,
            error: ex instanceof Error ? ex.message : String(ex),
          },
        }),
      )

      return { error: ex }
    }
  }

  /**
   * Returns the last recorded transaction for a source intent contract.
   *
   * @param sourceChainID the sourceChainID to get the last recorded transaction for
   * @returns
   */
  async getLastRecordedTx(sourceChainID: bigint): Promise<IntentFundedEventModel | undefined> {
    const lastTxs = await this.model
      .find({ sourceChainID })
      .sort({ blockNumber: -1 })
      .limit(1)
      .exec()

    return lastTxs[0]
  }
}
