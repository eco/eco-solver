import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Hex } from 'viem'

import { IntentSourceModel } from './schemas/intent-source.schema'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { UtilsIntentService } from './utils-intent.service'
import { WithdrawalLog } from '@/contracts/intent-source'
import { Serialize } from '@/common/utils/serialize'
import { WithdrawalRepository } from './withdrawal.repository'
import { Network } from '@/common/alchemy/network'

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
      // Check if withdrawal already exists to prevent duplicates
      const existingWithdrawal = await this.withdrawalRepository.exists(
        withdrawalEvent.transactionHash,
        withdrawalEvent.logIndex,
      )

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
            properties: { intentHash, withdrawalEvent },
          }),
        )
        return
      }

      // Create withdrawal record with event data
      const eventData = {
        sourceChainID:
          typeof withdrawalEvent.sourceChainID === 'object'
            ? BigInt(withdrawalEvent.sourceChainID.hex)
            : BigInt(withdrawalEvent.sourceChainID),
        sourceNetwork: withdrawalEvent.sourceNetwork as Network,
        blockNumber:
          typeof withdrawalEvent.blockNumber === 'object'
            ? BigInt(withdrawalEvent.blockNumber.hex)
            : BigInt(withdrawalEvent.blockNumber),
        blockHash: withdrawalEvent.blockHash,
        transactionIndex: withdrawalEvent.transactionIndex,
        removed: withdrawalEvent.removed,
        address: withdrawalEvent.address,
        data: withdrawalEvent.data,
        topics: withdrawalEvent.topics,
        transactionHash: withdrawalEvent.transactionHash,
        logIndex: withdrawalEvent.logIndex,
      }

      const withdrawalRecord = await this.withdrawalRepository.create({
        event: eventData,
        intentHash,
        intentId: model._id,
        recipient: args.recipient as Hex,
      })

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
          message: 'Intent status updated to WITHDRAWN and withdrawal record created',
          properties: {
            intentHash,
            recipient: args.recipient,
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
            intentHash,
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
