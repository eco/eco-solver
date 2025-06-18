import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Hex } from 'viem'

import { IntentSourceModel } from './schemas/intent-source.schema'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { UtilsIntentService } from './utils-intent.service'
import { WithdrawalLog } from '@/contracts/intent-source'
import { Serialize } from '@/common/utils/serialize'

/**
 * Service for handling withdrawal events from IntentSource contracts.
 * Updates intent status to WITHDRAWN when a withdrawal event is detected.
 */
@Injectable()
export class WithdrawalService {
  private logger = new Logger(WithdrawalService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly utilsIntentService: UtilsIntentService,
  ) {}

  /**
   * Processes a withdrawal event by updating the intent status to WITHDRAWN
   *
   * @param withdrawalEvent - The serialized withdrawal event from the blockchain
   */
  async processWithdrawal(withdrawalEvent: Serialize<WithdrawalLog>): Promise<void> {
    const { args } = withdrawalEvent

    if (!args?.hash) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Withdrawal event missing hash',
          properties: { withdrawalEvent },
        }),
      )
      return
    }

    const intentHash = args.hash as Hex

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Processing withdrawal event',
        properties: {
          intentHash,
          recipient: args.recipient,
          logIndex: withdrawalEvent.logIndex,
          transactionHash: withdrawalEvent.transactionHash,
        },
      }),
    )

    try {
      // Find the intent by hash
      const model = await this.intentModel.findOne({
        'intent.hash': intentHash,
      })

      if (!model) {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'Intent not found for withdrawal event',
            properties: { intentHash, withdrawalEvent },
          }),
        )
        return
      }

      // Update the intent status to WITHDRAWN
      model.status = 'WITHDRAWN'
      model.receipt = {
        ...model.receipt,
        withdrawalHash: withdrawalEvent.transactionHash,
        withdrawalRecipient: args.recipient,
        withdrawalLogIndex: withdrawalEvent.logIndex,
      } as any

      await this.utilsIntentService.updateIntentModel(model)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Intent status updated to WITHDRAWN',
          properties: {
            intentHash,
            recipient: args.recipient,
            transactionHash: withdrawalEvent.transactionHash,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing withdrawal event',
          properties: {
            intentHash,
            error: error.message || error,
            withdrawalEvent,
          },
        }),
      )
      throw error
    }
  }
}
