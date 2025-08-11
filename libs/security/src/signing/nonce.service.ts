import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel, InjectQueue } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Queue } from 'bullmq'
import { Hex, createPublicClient, extractChain } from 'viem'
import { sha256 } from 'viem'
import { entries } from 'lodash'
import { IEcoConfigService, AtomicNonceService, AtomicKeyClientParams } from '@libs/shared'
import { ChainsSupported, getTransport, QUEUES, JobsOptions } from '@libs/shared'
import { SignerService } from './signer.service'
import { Nonce } from './schemas/nonce.schema'

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
    private readonly ecoConfigService: IEcoConfigService,
  ) {
    super(nonceModel)
  }
  async onApplicationBootstrap() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
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
      const { rpcUrls, config } = this.ecoConfigService.getRpcUrls(chain)
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
