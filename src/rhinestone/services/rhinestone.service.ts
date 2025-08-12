import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { encodeAbiParameters, encodeFunctionData, erc20Abi, Hash, pad, zeroAddress } from 'viem'
import * as _ from 'lodash'

import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { FeeService } from '@/fee/fee.service'
import { EcoAnalyticsService } from '@/analytics'
import { RhinestoneWebsocketService } from './rhinestone-websocket.service'
import {
  ChainExecution,
  FillAction,
  RHINESTONE_EVENTS,
  RhinestonePingMessage,
  RhinestoneRelayerActionV1,
} from '../types/rhinestone-websocket.types'
import { RhinestoneValidatorService } from '@/rhinestone/services/rhinestone-validator.service'
import { hashIntent, InboxAbi, IntentType } from '@eco-foundation/routes-ts'
import { getChainConfig } from '@/eco-configs/utils'
import { ProofService } from '@/prover/proof.service'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'

/**
 * Main service for handling Rhinestone WebSocket events and executing transactions.
 * Listens for relayer actions and executes fills and claims on-chain.
 */
@Injectable()
export class RhinestoneService implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly walletClient: WalletClientDefaultSignerService,
    private readonly kernelAccountClient: KernelAccountClientService,
    private readonly rhinestoneWebsocketService: RhinestoneWebsocketService,
    private readonly rhinestoneValidatorService: RhinestoneValidatorService,
    private readonly feeService: FeeService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly proofService: ProofService,
    private readonly walletFulfillService: WalletFulfillService,
  ) {}

  /**
   * Initialize the service by connecting to the WebSocket server
   */
  async onModuleInit() {
    // Connect to the WebSocket server
    await this.rhinestoneWebsocketService.connect()
  }

  /**
   * Handle WebSocket connection events
   */
  @OnEvent(RHINESTONE_EVENTS.CONNECTED)
  handleConnection() {
    this.logger.log('Connected to Rhinestone WebSocket')
  }

  /**
   * Handle WebSocket disconnection events
   * @param payload Contains disconnection code and reason
   */
  @OnEvent(RHINESTONE_EVENTS.DISCONNECTED)
  handleDisconnection(payload: { code: number; reason: string }) {
    this.logger.log(`Disconnected from Rhinestone WebSocket: ${payload.code} - ${payload.reason}`)
  }

  /**
   * Handle incoming ping messages from the WebSocket server
   * @param message The ping message
   */
  @OnEvent(RHINESTONE_EVENTS.MESSAGE_PING)
  handlePingMessage(message: RhinestonePingMessage) {
    this.logger.log(`Received Ping message: ${JSON.stringify(message)}`)
  }

  /**
   * Handle incoming relayer action messages, validate, and execute them
   * @param message The relayer action containing fills and claims
   */
  @OnEvent(RHINESTONE_EVENTS.RELAYER_ACTION_V1)
  async handleRelayerAction(message: RhinestoneRelayerActionV1) {
    this.logger.log(`Received RhinestoneRelayerActionV1`)

    // Throws if the message is invalid
    const { claimFills } = await this.rhinestoneValidatorService.validateRelayerAction(message)

    const intents = claimFills.map((item) => item.intent)

    for (const intent of intents) {
      // Get intent hash for analytics tracking
      const { intentHash } = hashIntent(intent)

      // Track feasibility check start
      this.ecoAnalytics.trackIntentFeasibilityCheckStarted(intentHash)

      // Check if the route is feasible
      const { error: feasibilityError } = await this.feeService.isRouteFeasible(intent)

      if (feasibilityError) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Intent is not feasible',
            properties: {
              actionId: message.id,
              intentHash,
              error: feasibilityError.message,
            },
          }),
        )
        throw new Error('Intent feasibility failed')
      }
    }

    try {
      const result = await this.executeRelayerAction(message, intents)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Relayer action processed successfully',
          properties: {
            actionId: message.id,
            fillTxHash: result.fillTxHash,
            claimsExecuted: result.claimTxHashes.length,
            claimFills: claimFills.length,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to process relayer action',
          properties: {
            actionId: message.id,
            error: error.message,
          },
        }),
      )
    }
  }

  /**
   * Handle WebSocket error events
   * @param error The error that occurred
   */
  @OnEvent(RHINESTONE_EVENTS.ERROR)
  handleError(error: Error) {
    this.logger.error(`WebSocket error: ${error.message}`)
  }

  /**
   * Execute a relayer action's fill and claims in order
   * @param action The relayer action containing the fill details and claims
   * @param intents Array of validated intents for the claims
   * @returns Object containing all transaction hashes
   */
  async executeRelayerAction(
    action: RhinestoneRelayerActionV1,
    intents: IntentType[],
  ): Promise<{
    fillTxHash: Hash
    claimTxHashes: { id: number; txHash: Hash; beforeFill: boolean }[]
  }> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Executing relayer action ${action.id}`,
        properties: {
          actionId: action.id,
          fillId: action.fill.id,
          claimsCount: action.claims.length,
          chainId: action.fill.call.chainId,
        },
      }),
    )

    const claimTxHashes: { id: number; txHash: Hash; beforeFill: boolean }[] = []

    // Step 1: Execute claims with beforeFill = true
    const beforeFillClaims = action.claims.filter((claim) => claim.beforeFill)
    for (const claim of beforeFillClaims) {
      try {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `Executing beforeFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              chainId: claim.call.chainId,
            },
          }),
        )

        const txHash = await this.executeTransaction(claim.call)
        claimTxHashes.push({ id: claim.id, txHash, beforeFill: true })

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `BeforeFill claim ${claim.id} executed successfully`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              txHash,
            },
          }),
        )
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Failed to execute beforeFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              error: error.message,
            },
          }),
        )
        throw error
      }
    }

    // Step 2: Execute the fill with approval
    let fillTxHash: Hash
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing fill ${action.fill.id} with approval`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            chainId: action.fill.call.chainId,
          },
        }),
      )

      fillTxHash = await this.executeFill(action.fill, intents)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill ${action.fill.id} executed successfully`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            txHash: fillTxHash,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to execute fill ${action.fill.id}`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            error: error.message,
          },
        }),
      )
      throw error
    }

    // Step 3: Execute remaining claims (beforeFill = false)
    const afterFillClaims = action.claims.filter((claim) => !claim.beforeFill)
    for (const claim of afterFillClaims) {
      try {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `Executing afterFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              chainId: claim.call.chainId,
            },
          }),
        )

        const txHash = await this.executeTransaction(claim.call)
        claimTxHashes.push({ id: claim.id, txHash, beforeFill: false })

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `AfterFill claim ${claim.id} executed successfully`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              txHash,
            },
          }),
        )
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Failed to execute afterFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              error: error.message,
            },
          }),
        )
        throw error
      }
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Relayer action ${action.id} completed successfully`,
        properties: {
          actionId: action.id,
          fillTxHash,
          claimTxHashesCount: claimTxHashes.length,
        },
      }),
    )

    return {
      fillTxHash,
      claimTxHashes,
    }
  }

  /**
   * Execute a transaction on the specified chain
   * @param execution The chain execution details
   * @returns The transaction hash
   */
  private async executeTransaction(execution: ChainExecution): Promise<Hash> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing transaction on chain ${execution.chainId}`,
          properties: {
            chainId: execution.chainId,
            to: execution.to,
            value: execution.value.toString(),
            data: execution.data,
          },
        }),
      )

      const client = await this.walletClient.getClient(execution.chainId)

      const txHash = await client.sendTransaction({
        to: execution.to,
        value: BigInt(execution.value),
        data: execution.data,
        chain: client.chain,
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Transaction sent successfully`,
          properties: {
            chainId: execution.chainId,
            txHash,
          },
        }),
      )

      return txHash
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to execute transaction`,
          properties: {
            chainId: execution.chainId,
            to: execution.to,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Execute a fill transaction with approval
   * @param fill The fill action details
   * @param intents
   * @returns The transaction hash
   */
  private async executeFill(fill: FillAction, intents: IntentType[]): Promise<Hash> {
    try {
      const transactions: ExecuteSmartWalletArg[] = []

      // Aggregate route token approvals
      const routeTokens = intents.flatMap((intent) => intent.route.tokens)
      const routeTokenGroups = _.groupBy(routeTokens, 'token')
      const routeTokenTotal = Object.values(routeTokenGroups).map((group) => {
        const { token } = group[0]
        const amount = group.reduce((acc, token) => acc + token.amount, 0n)
        return { token, amount }
      })

      // Construct approval transactions
      routeTokenTotal.forEach(({ token, amount }) => {
        const approvalTx: ExecuteSmartWalletArg = {
          to: token,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [fill.call.to, amount],
          }),
        }
        transactions.push(approvalTx)
      })

      // Add the fill transaction
      const fillTx: ExecuteSmartWalletArg = {
        to: fill.call.to,
        value: BigInt(fill.call.value),
        data: fill.call.data,
      }
      transactions.push(fillTx)

      // Prove transactions
      const requests = intents.map(async (intent) => {
        const proverType = this.proofService.getProverType(
          Number(intent.route.source),
          intent.reward.prover,
        )
        if (!proverType?.isHyperlane()) throw new Error('Rhinestone: Invalid prover type')

        const { HyperProver: hyperProverAddr } = getChainConfig(Number(intent.route.destination))

        const { intentHash } = hashIntent(intent)

        const messageData = encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
          [pad(intent.reward.prover), '0x', zeroAddress],
        )

        const txData = encodeFunctionData({
          abi: InboxAbi,
          functionName: 'initiateProving',
          args: [intent.route.source, [intentHash], hyperProverAddr, messageData],
        })

        const claimant = this.ecoConfigService.getEth().claimant

        const proverFee = await this.walletFulfillService.getProverFee(
          intent,
          claimant,
          hyperProverAddr,
          messageData,
        )

        transactions.push({
          to: intent.route.inbox,
          data: txData,
          value: proverFee,
        })
      })

      // Wait for the proving transactions
      await Promise.all(requests)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing fill with KernelAccountClient`,
          properties: {
            fillId: fill.id,
            chainId: fill.call.chainId,
            transactionCount: transactions.length,
          },
        }),
      )

      const client = await this.kernelAccountClient.getClient(fill.call.chainId)
      return await client.execute(transactions)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to execute fill with approval`,
          properties: {
            fillId: fill.id,
            chainId: fill.call.chainId,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }
}
