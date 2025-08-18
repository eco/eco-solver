import { Hex, NonceManagerSource, Prettify, PublicClient } from 'viem'
import type { Address } from 'abitype'
import { Model, QueryOptions } from 'mongoose'
import type { Client } from 'viem/_types/clients/createClient'
import { Injectable, Logger } from '@nestjs/common'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { getAtomicNonceKey } from './sign.helper'

export type AtomicKeyParams = {
  address: Hex
  chainId: number
}

export type AtomicKeyClientParams = Prettify<
  Pick<AtomicKeyParams, 'address'> & {
    client: PublicClient
  }
>

export type AtomicGetParameters = Prettify<AtomicKeyParams & { client: Client }>

/** An atomic JSON-RPC source for a nonce manager. It initializes the nonce
 * to the current RPC returned transaction count, then it stores and increments
 * the nonce through an atomic call locally. Ie. a database that can enforce atomicity.
 *
 * This way the account for the nonce can be shared amongs multiple processes simultaneously without
 * the treat of nonce collisions. Such as in a kubernetes cluster.
 */
@Injectable()
export abstract class AtomicNonceService<T extends { nonce: number }>
  implements NonceManagerSource
{
  protected logger = new Logger(AtomicNonceService.name)

  constructor(protected model: Model<T>) {}

  async syncNonces(): Promise<void> {
    const params: AtomicKeyClientParams[] = await this.getSyncParams()
    if (params.length === 0) {
      return
    }

    const nonceSyncs = params.map(async (param: AtomicKeyClientParams) => {
      const { address, client } = param
      const nonceNum = await client.getTransactionCount({ address, blockTag: 'pending' })

      return {
        nonceNum,
        chainID: client.chain?.id,
        address: address,
      }
    })

    try {
      const updatedNonces = await Promise.all(nonceSyncs)
      const updates = updatedNonces.map(async (nonce) => {
        const { address, chainID } = nonce
        const key = getAtomicNonceKey({ address, chainId: chainID ?? 0 })
        const query = { key }
        const updates = { $set: { nonce: nonce.nonceNum, chainID, address } }
        const options = { upsert: true, new: true }
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `AtomicNonceService: updating nonce in sync`,
            properties: {
              query,
              updates,
            },
          }),
        )
        return this.model.findOneAndUpdate(query, updates, options).exec()
      })

      await Promise.all(updates)
    } catch (e) {
      EcoLogMessage.fromDefault({
        message: `Error syncing nonces`,
        properties: {
          error: e,
        },
      })
    }
  }

  async get(parameters: AtomicGetParameters): Promise<number> {
    return await this.getIncNonce(parameters)
  }

  async set(params: AtomicGetParameters, nonce: number): Promise<void> {} // eslint-disable-line @typescript-eslint/no-unused-vars

  async getIncNonce(parameters: AtomicGetParameters): Promise<number> {
    const query = { key: getAtomicNonceKey(parameters) }
    const updates = { $inc: { nonce: 1 } }
    const options: QueryOptions = {
      upsert: true, //creates a new document if one doesn't exist
      new: true, //returns the updated document instead of the document before update
    }
    //get and increment from db
    const updateResponse = await this.model.findOneAndUpdate(query, updates, options).exec()
    return updateResponse?.nonce ?? 0
  }

  protected async getSyncParams(): Promise<AtomicKeyClientParams[]> {
    return []
  }

  async getNonces(): Promise<T[]> {
    return this.model.find().exec()
  }

  static getNonceQueueKey(address: Address, chainId: number): string {
    return `${address}.${chainId}`
  }
}
