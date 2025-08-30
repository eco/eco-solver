import { EcoLogger } from '@/common/logging/eco-logger'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

@Injectable()
export class RebalanceRepository {
  private logger = new EcoLogger(RebalanceRepository.name)

  constructor(@InjectModel(RebalanceModel.name) private model: Model<RebalanceModel>) {}

  async queryRebalances(query: object, projection: object = {}): Promise<RebalanceModel[]> {
    return this.model.find(query, projection)
  }

  async create(rebalanceModel: RebalanceModel): Promise<RebalanceModel> {
    return this.model.create(rebalanceModel)
  }

  async updateStatus(
    rebalanceJobID: string,
    status: RebalanceStatus,
  ): Promise<RebalanceModel | null> {
    return this.update({ rebalanceJobID }, { status: status.toString() })
  }

  async update(query: object, updates: object, options?: object): Promise<RebalanceModel | null> {
    const updateOptions = options || { upsert: false, new: true }
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates }

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions)

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false })
      return rest as RebalanceModel
    }

    return null
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'))
  }

  async insertMany(models: RebalanceModel[]): Promise<any> {
    return this.model.insertMany(models)
  }

  async deleteMany(query: object): Promise<any> {
    return this.model.deleteMany(query)
  }

  /**
   * Returns a map of reserved amounts (sum of amountIn) for tokens that are part of
   * pending rebalances for the provided wallet.
   * Key format: `${chainId}:${tokenAddressLowercase}` → bigint amountIn
   */
  async getPendingReservedByTokenForWallet(walletAddress: string): Promise<Map<string, bigint>> {
    const map = new Map<string, bigint>()

    // Use simple find + in-memory sum for testability and bigint safety
    const docs = await this.model
      .find(
        {
          status: RebalanceStatus.PENDING.toString(),
          wallet: walletAddress,
        },
        { amountIn: 1, tokenIn: 1, wallet: 1, status: 1 },
      )
      .lean()

    for (const doc of docs) {
      const { chainId, tokenAddress } = doc.tokenIn
      const amountIn = BigInt(doc.amountIn)

      // Ignore non-positive reservations
      if (amountIn <= 0n) {
        continue
      }

      const key = `${chainId}:${String(tokenAddress).toLowerCase()}`
      const prev = map.get(key) ?? 0n
      map.set(key, prev + amountIn)
    }

    return map
  }

  /**
   * Returns a map of incoming in-flight amounts (sum of amountOut) for tokens that are part of
   * pending rebalances for the provided wallet.
   * Key format: `${chainId}:${tokenAddressLowercase}` → bigint amountOut
   */
  async getPendingIncomingByTokenForWallet(walletAddress: string): Promise<Map<string, bigint>> {
    const map = new Map<string, bigint>()

    const docs = await this.model
      .find(
        {
          status: RebalanceStatus.PENDING.toString(),
          wallet: walletAddress,
        },
        { amountOut: 1, tokenOut: 1, wallet: 1, status: 1 },
      )
      .lean()

    for (const doc of docs) {
      const { chainId, tokenAddress } = doc.tokenOut || {}
      if (chainId === undefined || !tokenAddress) {
        continue
      }
      const amountOut = BigInt(doc.amountOut ?? 0n)
      if (amountOut <= 0n) continue

      const key = `${chainId}:${String(tokenAddress).toLowerCase()}`
      const previous = map.get(key) ?? 0n
      map.set(key, previous + amountOut)
    }

    return map
  }
}
