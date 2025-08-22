import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Nonce } from './schemas/nonce.schema'
import { JobsOptions, Queue } from 'bullmq'
import { QUEUES } from '../common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { EcoConfigService } from '@libs/solver-config'
import { entries } from 'lodash'
import { AtomicKeyClientParams, AtomicNonceService } from './atomic.nonce.service'
import { createPublicClient, extractChain, sha256 } from 'viem'
import { Hex } from 'viem'
import { SignerService } from './signer.service'
import { getTransport } from '../common/chains/transport'
import { ChainsSupported } from '../common/chains/supported'

/**
 * TODO this class needs to be assigned to an EAO, a userOp gets its nonce throught the alchemy sdk
 * which pulls its fromt the rpc bundler
 */
@Injectable()
export class NonceService extends AtomicNonceService<Nonce> implements OnApplicationBootstrap {
  protected logger = new Logger(NonceService.name)
  private intentJobConfig: JobsOptions

  constructor(
    @InjectModel(Nonce.name) private nonceModel: Model<Nonce>,
    @InjectQueue(QUEUES.SIGNER.queue) private readonly signerQueue: Queue,
    private readonly signerService: SignerService,
    private readonly ecoConfigService: EcoConfigService,
  ) {
    super(nonceModel)
  }
  async onApplicationBootstrap() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig as any
    this.syncQueue()
  }

  async syncQueue() {
    const { should, hash } = await this.shouldSync()
    if (should) {
      await this.signerQueue.add(
        QUEUES.SIGNER.jobs.nonce_sync,
        {},
        {
          jobId: hash,
          ...this.intentJobConfig,
        },
      )
    }
  }

  protected override async getSyncParams(): Promise<AtomicKeyClientParams[]> {
    const address = this.signerService.getAccount().address
    const paramsAsync = entries(this.ecoConfigService.getSolvers()).map(async ([chainIdString]) => {
      const chainID = parseInt(chainIdString)
      const chain = extractChain({ chains: ChainsSupported, id: chainID })
      const { rpcUrls, config } = this.ecoConfigService.getRpcUrls(chainID)
      const transport = getTransport(rpcUrls, config)
      const client = createPublicClient({ chain, transport })
      return { address, client } as AtomicKeyClientParams
    })

    return await Promise.all(paramsAsync)
  }

  async getLastSynceAt(): Promise<Date> {
    const meta = await this.nonceModel
      .findOne({ updatedAt: { $exists: true } })
      .sort({ updatedAt: -1 })
      .exec()
    if (!meta) {
      return new Date(0)
    }
    return meta.updatedAt
  }

  async shouldSync(): Promise<{ should: boolean; hash: string }> {
    const lastSyncAt = await this.getLastSynceAt()
    const should =
      Date.now() - lastSyncAt.getTime() > this.ecoConfigService.getEth().nonce.update_interval_ms
    const input = `0x${lastSyncAt.toISOString()}` as Hex
    return { should, hash: sha256(input) }
  }
}
