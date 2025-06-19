import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Hex } from 'viem'

import { IntentSourceModel } from './schemas/intent-source.schema'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { UtilsIntentService } from './utils-intent.service'
import { WithdrawalLog } from '@/contracts/intent-source'
import { Serialize, deserialize } from '@/common/utils/serialize'
import { WithdrawalRepository } from './repositories/withdrawal.repository'

/**
 * Service for handling withdrawal events from IntentSource contracts.
 * Updates intent status to WITHDRAWN when a withdrawal event is detected.
 * Creates withdrawal records in the database for filtering and querying.
 */
@Injectable()
export class WithdrawalService {
  private logger = new Logger(WithdrawalService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly withdrawalRepository: WithdrawalRepository,
  ) {}

  /**
   * Processes a withdrawal event by updating the intent status to WITHDRAWN
   * and creating a withdrawal record in the database
   *
   * @param serializedWithdrawalEvent - The serialized withdrawal event from the blockchain
   */
  async processWithdrawal(serializedWithdrawalEvent: Serialize<WithdrawalLog>): Promise<void> {
    const withdrawalEvent = deserialize(serializedWithdrawalEvent)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `processWithdrawal ${withdrawalEvent.transactionHash}`,
        properties: {
          transactionHash: withdrawalEvent.transactionHash,
          intentHash: withdrawalEvent.args?.hash,
          recipient: withdrawalEvent.args?.recipient,
        },
      }),
    )
    try {
      // Extract hash and recipient first to validate the event
      const intentHash = withdrawalEvent.args?.hash as Hex
      const recipient = withdrawalEvent.args?.recipient as Hex

      // Early validation - if we can't extract hash or recipient, skip processing
      if (!intentHash || !recipient) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Withdrawal event missing required fields (hash or recipient)',
            properties: {
              intentHash,
              recipient,
              transactionHash: withdrawalEvent.transactionHash,
            },
          }),
        )
        return
      }

      // Check if withdrawal already exists to prevent duplicates
      const existingWithdrawal = await this.withdrawalRepository.exists(intentHash)
      if (existingWithdrawal) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Withdrawal already processed',
            properties: {
              intentHash,
              transactionHash: withdrawalEvent.transactionHash,
              logIndex: withdrawalEvent.logIndex,
            },
          }),
        )
        return
      }

      // Find the intent by hash
      const model = await this.intentModel.findOne({
        'intent.hash': intentHash,
      })

      if (!model) {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'Intent not found for withdrawal event',
            properties: { intentHash: intentHash, withdrawalEvent },
          }),
        )
        return
      }

      // Create withdrawal record using repository factory methods
      const withdrawalParams = WithdrawalRepository.createWithdrawalParams(
        withdrawalEvent,
        model._id,
      )
      const withdrawalRecord = await this.withdrawalRepository.create(withdrawalParams)

      // Update the intent status to WITHDRAWN and link the withdrawal
      model.status = 'WITHDRAWN'
      model.withdrawalId = withdrawalRecord._id as Types.ObjectId

      await this.utilsIntentService.updateIntentModel(model)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Intent status updated to WITHDRAWN and withdrawal record created',
          properties: {
            intentHash,
            recipient,
            transactionHash: withdrawalEvent.transactionHash,
            withdrawalId: withdrawalRecord._id,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing withdrawal event',
          properties: {
            intentHash: WithdrawalRepository.extractIntentHash(withdrawalEvent),
            error: error.message || error,
            withdrawalEvent,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Get withdrawals by recipient address
   */
  async getWithdrawalsByRecipient(recipient: Hex) {
    return this.withdrawalRepository.findByRecipient(recipient)
  }

  /**
   * Get withdrawals by intent hash
   */
  async getWithdrawalsByIntentHash(intentHash: Hex) {
    return this.withdrawalRepository.findByIntentHash(intentHash)
  }

  /**
   * Get withdrawal statistics for a recipient
   */
  async getWithdrawalStats(recipient: Hex) {
    return this.withdrawalRepository.getStatsByRecipient(recipient)
  }
}
