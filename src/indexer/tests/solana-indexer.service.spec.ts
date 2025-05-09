import { SolanaIndexerService } from '@/indexer/services/solana-indexer.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { Test } from '@nestjs/testing'
import { PublicKey } from '@solana/web3.js'

describe('SolanaIndexerService', () => {
  let indexer: SolanaIndexerService
  const mockQueue = { add: jest.fn() } as unknown as Queue
  const mockUtils = { updateIntentModel: jest.fn() } as unknown as UtilsIntentService
  const mockCfg = {
    getSolanaConfig: () => ({
      rpc_url: 'http://localhost:8899',
      rpc_ws_url: 'ws://localhost:8900',
      router_program_id: '11111111111111111111111111111111',
    }),
  } as EcoConfigService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SolanaIndexerService,
        { provide: UtilsIntentService, useValue: mockUtils },
        { provide: EcoConfigService, useValue: mockCfg },
        { provide: 'BullQueue_solana_intent', useValue: mockQueue },
      ],
    }).compile()

    indexer = moduleRef.get(SolanaIndexerService)
  })

  it('pushes a job when decode succeeds', async () => {
    const { decodeIntentAccount } = require('@/indexer/services/solana-intent-decoder')
    const fakeIntent = decodeIntentAccount(
      new PublicKey('B6cg8ixxxxxxx1111111111111111111111'),
      Buffer.concat([Buffer.from('f7a223a5fe6f816d', 'hex'), Buffer.alloc(400)]),
    )

    await (indexer as any).handleIntent(fakeIntent)

    expect(mockUtils.updateIntentModel).toHaveBeenCalled()
    expect(mockQueue.add).toHaveBeenCalledWith(
      'feasable_intent',
      fakeIntent.hash,
      expect.objectContaining({ jobId: fakeIntent.hash }),
    )
  })
})
