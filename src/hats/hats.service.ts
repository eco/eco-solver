import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Database } from './database.types'
import { BalanceService } from '@/balance/balance.service'
import { formatUnits, parseUnits } from 'viem'
import { ChainsSupported } from '@/common/chains/supported'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { InjectQueue } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Queue } from 'bullmq'
import { WebClient } from '@slack/web-api'
import { getRandomDistributionMessage } from '@/hats/utils'

@Injectable()
export class HatsService implements OnModuleInit {
  private readonly logger = new Logger(HatsService.name)
  private supabaseClient: SupabaseClient<Database>
  private slackWebClient: WebClient

  // private readonly ACCUMULATION_PERIOD_DURATION = 604800; // 7 days in seconds
  private readonly ACCUMULATION_PERIOD_DURATION = 3600 // 1 hour in seconds

  private readonly REWARD_PERIOD_DURATION = 600 // 10 minutes in seconds

  // private readonly REWARD_PERIOD_RANGE = [28800, 72000]; // 8-20 hours in seconds
  private readonly REWARD_PERIOD_RANGE = [600, 1200] // 10-20 minutes in seconds

  constructor(
    @InjectQueue(QUEUES.HATS.queue)
    private readonly hatsQueue: Queue,
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  async onModuleInit() {
    this.supabaseClient = createClient<Database>(
      this.ecoConfigService.getHats().supabase.url,
      this.ecoConfigService.getHats().supabase.key,
    )
    this.slackWebClient = new WebClient(this.ecoConfigService.getHats().slack.token)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${HatsService.name}.onModuleInit()`,
      }),
    )
  }

  async weeklyUpdate() {
    // fetch solver balance
    const currentSolverBalance = parseUnits((await this.fetchSolverBalance()).toString(), 6)

    // log balance at this time just incase there is a failure
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${HatsService.name}.weeklyUpdate`,
        properties: {
          currentSolverBalance: currentSolverBalance.toString(),
        },
      }),
    )

    // get and update the previous accumulation period if it exists
    const { data: firstAccumulationPeriod, error } = await this.supabaseClient
      .from('accumulation_periods')
      .select()
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!error && firstAccumulationPeriod) {
      // get the starting balance of all the accumulation periods
      const startingSolverBalance = BigInt(firstAccumulationPeriod.starting_solver_balance)

      // calculate the distribution amount for this week that just ended
      const distributionAmount = currentSolverBalance - startingSolverBalance

      // update this last week's distribution amount
      const { data: prevAccumulationPeriod, error: updateError } = await this.supabaseClient
        .from('accumulation_periods')
        .update({ distribution_amount: parseFloat(formatUnits(distributionAmount, 6)) })
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (updateError || !prevAccumulationPeriod) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.weeklyUpdate - failed to update last week's distribution amount`,
            properties: {
              error: updateError,
              distributionAmount: formatUnits(distributionAmount, 6),
            },
          }),
        )
      }

      if (distributionAmount > 0) {
        // Create a reward period for the completed accumulation period
        const rewardPeriodData = await this.createNewRewardPeriod(prevAccumulationPeriod!.id)

        if (rewardPeriodData) {
          const delay = Math.floor(rewardPeriodData.endTime.getTime() - Date.now()) + 10_000 // add 10 seconds to ensure it fires after the period ends

          this.hatsQueue.add(
            QUEUES.HATS.jobs.distribute,
            {
              accumulationPeriodId: rewardPeriodData.accumulationPeriodId,
              rewardPeriodId: rewardPeriodData.rewardPeriodId,
            },
            {
              jobId: QUEUES.HATS.jobs.distribute,
              delay,
              removeOnComplete: true,
            },
          )

          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `${HatsService.name}.weeklyUpdate - reward period created and distribution scheduled`,
              properties: {
                rewardPeriodId: rewardPeriodData.rewardPeriodId,
                accumulationPeriodId: rewardPeriodData.accumulationPeriodId,
                endTime: rewardPeriodData.endTime.toISOString(),
              },
            }),
          )

          this.sendSlackNotification(
            getRandomDistributionMessage(
              distributionAmount,
              rewardPeriodData.startTime,
              rewardPeriodData.endTime,
            ),
          )
        }
      }
    }

    // create a new accumulation period and set the starting balance to the current solver balance
    const { error: createError, data: accumulationPeriod } = await this.supabaseClient
      .from('accumulation_periods')
      .insert({
        started_at: new Date().toISOString(),
        duration: this.ACCUMULATION_PERIOD_DURATION,
        starting_solver_balance: parseFloat(formatUnits(currentSolverBalance, 6)),
      })
      .select()
      .single()

    if (createError || !accumulationPeriod) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.weeklyUpdate - failed to create new accumulation period`,
          properties: {
            error: createError,
            accumulationPeriod: accumulationPeriod,
          },
        }),
      )
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${HatsService.name}.weeklyUpdate complete`,
      }),
    )
  }

  async executeDistribution(accumulationPeriodId: number, rewardPeriodId: number) {
    const { data: eligiblePeriod, error: queryError } = await this.supabaseClient
      .from('accumulation_periods')
      .select(
        `
      id,
      distribution_amount
      `,
      )
      .eq('id', accumulationPeriodId)
      .single()

    if (queryError || !eligiblePeriod) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.executeDistribution - failed to fetch eligible accumulation period`,
          properties: {
            error: queryError,
            accumulationPeriodId,
          },
        }),
      )
      return
    }

    // Get the claims from the associated reward period
    const { data: claims, error: claimsError } = await this.supabaseClient
      .from('claims')
      .select('wallet_address')
      .eq('reward_period_id', rewardPeriodId)
      .not('wallet_address', 'is', null)

    if (claimsError) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.executeDistribution - failed to fetch claims`,
          properties: {
            error: claimsError,
            rewardPeriodId: rewardPeriodId,
          },
        }),
      )
      return
    }

    // Check if there are any valid claims
    const validClaims = claims.filter((claim) => claim.wallet_address)
    if (validClaims.length === 0) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.executeDistribution - no valid claims found for distribution`,
          properties: {
            rewardPeriodId: rewardPeriodId,
          },
        }),
      )

      // Insert a distribution record anyway to mark this as processed
      await this.recordDistribution(eligiblePeriod.id)
      return
    }

    try {
      // Calculate distribution amount per wallet
      const totalDistributionAmount = parseUnits(eligiblePeriod.distribution_amount!.toString(), 6)
      const amountPerWallet = totalDistributionAmount / BigInt(validClaims.length)

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.executeDistribution - preparing distribution`,
          properties: {
            totalAmount: formatUnits(totalDistributionAmount, 6),
            recipients: validClaims.map((claim) => claim.wallet_address),
            recipientCount: validClaims.length,
            amountPerWallet: formatUnits(amountPerWallet, 6),
          },
        }),
      )

      // Find the chain with the highest USDC balance
      let highestBalanceChain: number | null = null
      let highestBalance = BigInt(0)

      for (const chain of ChainsSupported) {
        try {
          const tokens = await this.balanceService.fetchTokenData(chain.id)
          const usdcBalance = tokens.reduce((acc, { token }) => {
            if (token.symbol !== 'USDC') {
              return acc
            }
            return acc + token.balance
          }, BigInt(0))

          if (usdcBalance > highestBalance) {
            highestBalance = usdcBalance
            highestBalanceChain = chain.id
          }

          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `${HatsService.name}.executeDistribution - chain balance`,
              properties: {
                chainId: chain.id,
                chainName: chain.name,
                usdcBalance: formatUnits(usdcBalance, 6),
              },
            }),
          )
        } catch (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `${HatsService.name}.executeDistribution - failed to get balance for chain`,
              properties: {
                error,
                chainId: chain.id,
                chainName: chain.name,
              },
            }),
          )
        }
      }

      // Verify we found a chain with USDC balance
      if (!highestBalanceChain) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.executeDistribution - no chain found with USDC balance`,
          }),
        )
        return
      }

      // Verify the balance is sufficient for the distribution
      if (highestBalance < totalDistributionAmount) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.executeDistribution - insufficient USDC balance for distribution`,
            properties: {
              chainId: highestBalanceChain,
              availableBalance: formatUnits(highestBalance, 6),
              requiredAmount: formatUnits(totalDistributionAmount, 6),
            },
          }),
        )
        return
      }

      // Prepare for the transaction
      const tokens = await this.balanceService.fetchTokenData(highestBalanceChain)
      const usdcToken = tokens.find(({ token }) => token.symbol === 'USDC')

      if (!usdcToken) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.executeDistribution - USDC token not found on selected chain`,
            properties: {
              chainId: highestBalanceChain,
            },
          }),
        )
        return
      }

      // Import required functions from viem
      const { encodeFunctionData } = await import('viem')
      const { ERC20Abi } = await import('@/contracts/ERC20.contract')

      // Create multicall transaction with ERC20 transfers
      const calls = validClaims.map((claim) => {
        const callData = encodeFunctionData({
          abi: ERC20Abi,
          functionName: 'transfer',
          args: [claim.wallet_address as `0x${string}`, amountPerWallet],
        })

        return {
          to: usdcToken.token.address,
          data: callData,
          value: BigInt(0),
        }
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.executeDistribution - executing multicall transfer`,
          properties: {
            chainId: highestBalanceChain,
            tokenAddress: usdcToken.token.address,
            recipientCount: calls.length,
            totalAmount: formatUnits(totalDistributionAmount, 6),
            amountPerWallet: formatUnits(amountPerWallet, 6),
          },
        }),
      )

      // Get the kernel account client and execute the transaction
      const client = await this.kernelAccountClientService.getClient(highestBalanceChain)

      try {
        // Execute the transaction
        const txHash = await client.execute(calls)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.executeDistribution - multicall transfer executed`,
            properties: {
              chainId: highestBalanceChain,
              callCount: calls.length,
              transactionHash: txHash,
            },
          }),
        )

        // Wait for confirmation
        await client.waitForTransactionReceipt({ hash: txHash, confirmations: 5 })

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.executeDistribution - transaction confirmed`,
            properties: {
              transactionHash: txHash,
            },
          }),
        )
      } catch (txError) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.executeDistribution - transaction execution failed`,
            properties: {
              error: txError,
              chainId: highestBalanceChain,
            },
          }),
        )
        throw txError
      }

      // Record the distribution
      await this.recordDistribution(eligiblePeriod.id)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.executeDistribution - failed to execute distribution`,
          properties: {
            error,
            accumulationPeriodId: eligiblePeriod.id,
          },
        }),
      )
    }
  }

  private async recordDistribution(accumulationPeriodId: number): Promise<void> {
    const { error } = await this.supabaseClient.from('distributions').insert({
      accumulation_period_id: accumulationPeriodId,
      distributed_at: new Date().toISOString(),
    })

    if (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.recordDistribution - failed to record distribution`,
          properties: {
            error,
            accumulationPeriodId,
          },
        }),
      )
    }
  }

  private async createNewRewardPeriod(accumulationPeriodId: number) {
    // Calculate a random start time in the reward period range
    const now = new Date()
    const minOffset = this.REWARD_PERIOD_RANGE[0]
    const maxOffset = this.REWARD_PERIOD_RANGE[1]

    // Generate random seconds within the range
    const randomOffset = minOffset + Math.floor(Math.random() * (maxOffset - minOffset))

    // Calculate start and end times
    const startTime = new Date(now.getTime() + randomOffset * 1000) // convert seconds to milliseconds
    const endTime = new Date(startTime.getTime() + this.REWARD_PERIOD_DURATION * 1000)

    // Create a new reward period associated with the accumulation period
    const { data: rewardPeriod, error: insertError } = await this.supabaseClient
      .from('reward_periods')
      .insert({
        accumulation_period_id: accumulationPeriodId,
        started_at: startTime.toISOString(),
        ended_at: endTime.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.createNewRewardPeriod - failed to create new reward period`,
          properties: {
            error: insertError,
          },
        }),
      )
      return null
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${HatsService.name}.createNewRewardPeriod - created new reward period`,
        properties: {
          rewardPeriodId: rewardPeriod.id,
          accumulationPeriodId: accumulationPeriodId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationSeconds: this.REWARD_PERIOD_DURATION,
        },
      }),
    )

    // Return the ids
    return {
      rewardPeriodId: rewardPeriod.id,
      accumulationPeriodId: accumulationPeriodId,
      startTime,
      endTime,
    }
  }

  private async fetchSolverBalance(): Promise<bigint> {
    // Initialize balance sum
    let totalBalance = BigInt(0)

    // Get the balance for each network
    for (const chain of ChainsSupported) {
      try {
        const tokens = await this.balanceService.fetchTokenData(chain.id)

        // Get the total USDC balance for this network
        const usdcBalance = tokens.reduce((acc, { token }) => {
          if (token.symbol !== 'USDC') {
            return acc
          }
          return acc + token.balance
        }, BigInt(0))

        totalBalance = totalBalance + usdcBalance
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${HatsService.name}.fetchSolverBalance - failed to get balance for chain: ${chain.name}`,
            properties: {
              error,
              network: chain.id.toString(),
            },
          }),
        )
      }
    }

    return totalBalance
  }

  private async sendSlackNotification(message: string) {
    try {
      await this.slackWebClient.chat.postMessage({
        channel: this.ecoConfigService.getHats().slack.conversationID,
        text: message,
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${HatsService.name}.sendSlackNotification - failed to send Slack notification`,
          properties: {
            error,
            slackMessage: message,
          },
        }),
      )
    }
  }
}
