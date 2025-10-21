import { Injectable, Logger } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Hex, parseUnits, isAddressEqual } from 'viem'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { buildApproveCalldata, buildSendCalldata, toBytes32Address } from './oft-client'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { oftV2Abi } from '@/contracts/OFTV2.abi'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckOFTDeliveryJobData } from '@/liquidity-manager/jobs/check-oft-delivery.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { USDT0ChainConfig } from '@/eco-configs/eco-config.types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

type SendParam = {
  dstEid: number
  to: Hex
  amountLD: bigint
  minAmountLD: bigint
}

@Injectable()
export class USDT0ProviderService implements IRebalanceProvider<'USDT0'> {
  private logger = new Logger(USDT0ProviderService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernel: LmTxGatedKernelAccountClientService,
    private readonly publicClient: MultichainPublicClientService,
    private readonly rebalanceRepository: RebalanceRepository,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {}

  getStrategy() {
    return 'USDT0' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'USDT0'>> {
    const cfg = this.ecoConfigService.getUSDT0()

    const src = cfg.chains.find((c) => c.chainId === tokenIn.chainId)
    const dst = cfg.chains.find((c) => c.chainId === tokenOut.chainId)
    if (!src || !dst) {
      this.logger.error(
        EcoLogMessage.withId({
          message: 'USDT0: getQuote: Unsupported chain pair',
          id,
          properties: { tokenIn, tokenOut },
        }),
      )
      throw new Error('USDT0 unsupported chain pair')
    }

    // Optional token address validation when config provides token/underlyingToken
    const srcExpected = src.type === 'adapter' ? src.underlyingToken : src.token
    const dstExpected = dst.type === 'adapter' ? dst.underlyingToken : dst.token

    const srcMismatch = srcExpected && !isAddressEqual(tokenIn.config.address as Hex, srcExpected)
    const dstMismatch = dstExpected && !isAddressEqual(tokenOut.config.address as Hex, dstExpected)

    if (srcMismatch || dstMismatch) {
      this.logger.error(
        EcoLogMessage.withId({
          message: 'USDT0: getQuote: Unsupported token',
          id,
          properties: {
            srcExpected,
            dstExpected,
            tokenInAddress: tokenIn.config.address,
            tokenOutAddress: tokenOut.config.address,
          },
        }),
      )
      throw new Error('USDT0 unsupported token')
    }

    const amountLD = parseUnits(String(swapAmount), tokenIn.balance?.decimals ?? 6)

    const walletAddress = await this.kernel.getAddress()

    const quote: RebalanceQuote<'USDT0'> = {
      amountIn: amountLD,
      amountOut: amountLD, // 1:1 token amount model
      slippage: 0,
      tokenIn,
      tokenOut,
      strategy: 'USDT0',
      context: {
        sourceChainId: tokenIn.chainId,
        sourceEid: src.eid,
        destinationEid: dst.eid,
        to: walletAddress as Hex,
        amountLD,
      },
      id,
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0: getQuote: Returning 1:1 quote',
        id,
        properties: {
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          sourceEid: src.eid,
          destinationEid: dst.eid,
          to: walletAddress,
          amountLD: amountLD,
        },
      }),
    )

    return quote
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'USDT0'>): Promise<Hex> {
    try {
      const cfg = this.ecoConfigService.getUSDT0()
      const src = cfg.chains.find((c) => c.chainId === quote.tokenIn.chainId)!
      const client = await this.kernel.getClient(quote.tokenIn.chainId)

      const sendParam = this.buildInitialSendParam(walletAddress, quote, src)
      const calls: { to: Hex; data: Hex; value?: bigint }[] = []

      this.addApproveIfAdapter(src, quote, calls, quote.id)

      const pc = await this.publicClient.getClient(quote.tokenIn.chainId)
      await this.updateMinAmountWithQuoteOFT(pc, src.contract as Hex, sendParam, quote.id)

      const nativeFee = await this.quoteSendFee(pc, src.contract as Hex, sendParam, quote.id)
      calls.push(
        this.buildSendCall(src.contract as Hex, sendParam, nativeFee, walletAddress as Hex),
      )

      const txHash = await this.broadcastBatch(client, calls, quote)
      await this.enqueueDeliveryCheck(quote, txHash as Hex, walletAddress as Hex)
      return txHash as Hex
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          id: quote.id,
          message: 'USDT0: execute: Failed',
          error: error as any,
          properties: {
            groupID: quote.groupID,
            rebalanceJobID: quote.rebalanceJobID,
            sourceChainId: quote.tokenIn.chainId,
            destinationChainId: quote.tokenOut.chainId,
            walletAddress,
          },
        }),
      )
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  private buildInitialSendParam(
    walletAddress: string,
    quote: RebalanceQuote<'USDT0'>,
    src: USDT0ChainConfig,
  ): SendParam {
    const to32 = toBytes32Address(walletAddress as Hex)
    const sendParam: SendParam = {
      dstEid: (quote.context as any).destinationEid as number,
      to: to32,
      amountLD: quote.amountIn,
      minAmountLD: quote.amountOut,
    }
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0: execute: Prepared sendParam',
        id: quote.id,
        properties: {
          groupID: quote.groupID,
          rebalanceJobID: quote.rebalanceJobID,
          sourceChainId: quote.tokenIn.chainId,
          destinationChainId: quote.tokenOut.chainId,
          srcType: src.type,
          dstEid: sendParam.dstEid,
          to: sendParam.to,
          amountLD: sendParam.amountLD,
          minAmountLD: sendParam.minAmountLD,
        },
      }),
    )
    return sendParam
  }

  private addApproveIfAdapter(
    src: USDT0ChainConfig,
    quote: RebalanceQuote<'USDT0'>,
    calls: { to: Hex; data: Hex; value?: bigint }[],
    id?: string,
  ) {
    if (src.type === 'adapter' && src.underlyingToken) {
      calls.push({
        to: src.underlyingToken,
        data: buildApproveCalldata(src.contract, quote.amountIn),
      })
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'USDT0: execute: Added approve for adapter',
          id,
          properties: { token: src.underlyingToken, spender: src.contract, amount: quote.amountIn },
        }),
      )
    }
  }

  private async updateMinAmountWithQuoteOFT(
    pc: Awaited<ReturnType<MultichainPublicClientService['getClient']>>,
    contract: Hex,
    sendParam: SendParam,
    id?: string,
  ) {
    try {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'USDT0: execute: Calling quoteOFT',
          id,
          properties: {
            contract,
            dstEid: sendParam.dstEid,
            amountLD: sendParam.amountLD,
          },
        }),
      )
      const receipt = (await pc.readContract({
        address: contract,
        abi: oftV2Abi,
        functionName: 'quoteOFT',
        args: [
          {
            dstEid: sendParam.dstEid,
            to: sendParam.to,
            amountLD: sendParam.amountLD,
            minAmountLD: 0n,
            extraOptions: '0x' as Hex,
            composeMsg: '0x' as Hex,
            oftCmd: '0x' as Hex,
          },
        ],
      })) as any
      const amountReceivedLD = receipt?.[2]?.amountReceivedLD ?? receipt?.receipt?.amountReceivedLD
      if (typeof amountReceivedLD === 'bigint') {
        sendParam.minAmountLD = amountReceivedLD
        this.logger.debug(
          EcoLogMessage.withId({
            message: 'USDT0: execute: Updated minAmountLD from quoteOFT',
            id,
            properties: { minAmountLD: sendParam.minAmountLD },
          }),
        )
      }
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.withErrorAndId({
          message: 'USDT0: execute: quoteOFT failed (continuing with default minAmountLD)',
          id,
          error: error as any,
          properties: { contract },
        }),
      )
    }
  }

  private async quoteSendFee(
    pc: Awaited<ReturnType<MultichainPublicClientService['getClient']>>,
    contract: Hex,
    sendParam: SendParam,
    id?: string,
  ): Promise<bigint> {
    const fee = (await pc.readContract({
      address: contract,
      abi: oftV2Abi,
      functionName: 'quoteSend',
      args: [
        {
          dstEid: sendParam.dstEid,
          to: sendParam.to,
          amountLD: sendParam.amountLD,
          minAmountLD: sendParam.minAmountLD,
          extraOptions: '0x' as Hex,
          composeMsg: '0x' as Hex,
          oftCmd: '0x' as Hex,
        },
        false,
      ],
    })) as { nativeFee: bigint; lzTokenFee: bigint }
    const nativeFee = fee?.nativeFee ?? 0n
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0: execute: quoteSend result',
        id,
        properties: { nativeFee, lzTokenFee: fee?.lzTokenFee },
      }),
    )
    return nativeFee
  }

  private buildSendCall(
    contract: Hex,
    sendParam: SendParam,
    nativeFee: bigint,
    walletAddress: Hex,
  ) {
    return {
      to: contract,
      data: buildSendCalldata(sendParam, nativeFee, walletAddress),
      value: nativeFee,
    } as { to: Hex; data: Hex; value?: bigint }
  }

  private async broadcastBatch(
    client: any,
    calls: { to: Hex; data: Hex; value?: bigint }[],
    quote: RebalanceQuote<'USDT0'>,
  ): Promise<Hex> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0: execute: Broadcasting Kernel batch',
        id: quote.id,
        properties: { calls: calls.length, sourceChainId: quote.tokenIn.chainId },
      }),
    )
    const txHash = (await client.execute(calls)) as Hex
    this.logger.log(
      EcoLogMessage.withId({
        message: 'USDT0: execute: Broadcasted',
        id: quote.id,
        properties: { txHash, sourceChainId: quote.tokenIn.chainId },
      }),
    )
    return txHash
  }

  private async enqueueDeliveryCheck(
    quote: RebalanceQuote<'USDT0'>,
    txHash: Hex,
    walletAddress: Hex,
  ) {
    try {
      const lmQueue = new LiquidityManagerQueue(this.queue)
      const data: CheckOFTDeliveryJobData = {
        groupID: quote.groupID!,
        rebalanceJobID: quote.rebalanceJobID!,
        sourceChainId: quote.tokenIn.chainId,
        destinationChainId: quote.tokenOut.chainId,
        txHash,
        walletAddress,
        amountLD: quote.amountOut.toString(),
        id: quote.id,
      }
      // Propagate optional USDT0-LiFi destination swap context if provided by caller
      const extraCtx = (quote as any)?.context?.usdt0LiFiContext
      if (extraCtx) (data as any).usdt0LiFiContext = extraCtx
      await lmQueue.startOFTDeliveryCheck(data)
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'USDT0: execute: Enqueued delivery confirmation job',
          id: quote.id,
          properties: data,
        }),
      )
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.withErrorAndId({
          message: 'USDT0: execute: Failed to enqueue delivery confirmation job',
          id: quote.id,
          error: error as any,
          properties: { groupID: quote.groupID, rebalanceJobID: quote.rebalanceJobID },
        }),
      )
    }
  }
}
