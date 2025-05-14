import { Test, TestingModule } from '@nestjs/testing'
import { SolanaIndexerService } from '@/indexer/services/solana-indexer.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { Queue } from 'bullmq'
import { PublicKey } from '@solana/web3.js'
import { QUEUES } from '@/common/redis/constants'

const mockOnProgramAccountChange = jest.fn()
const mockRemoveListener = jest.fn()

jest.mock('@solana/web3.js', () => {
  const real = jest.requireActual('@solana/web3.js')
  return {
    ...real,
    Connection: jest.fn().mockImplementation(() => ({
      onProgramAccountChange: mockOnProgramAccountChange,
      removeProgramAccountChangeListener: mockRemoveListener,
    })),
  }
})

const fakeIntent = { hash: '0xdeadbeef' } as any
jest.mock('@/indexer/services/solana-intent-decoder', () => ({
  decodeIntentAccount: jest.fn(() => fakeIntent),
}))

describe('SolanaIndexerService', () => {
  let indexer: SolanaIndexerService
  let programAccountChangeCallback: any

  // capture the callback each time onProgramAccountChange is called
  mockOnProgramAccountChange.mockImplementation((_publicKey: PublicKey, callback: any) => {
    programAccountChangeCallback = callback
    return 42
  })

  const mockQueue = { add: jest.fn() } as unknown as Queue
  const mockUtils = { updateIntentModel: jest.fn() } as unknown as UtilsIntentService
  const mockCfg = {
    getSolanaConfig: () => ({
      rpc_url: 'https://api.mainnet-beta.solana.com',
      rpc_ws_url: 'wss://api.mainnet-beta.solana.com',
      router_program_id: '11111111111111111111111111111111', // TODO
    }),
  } as unknown as EcoConfigService

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaIndexerService,
        { provide: EcoConfigService, useValue: mockCfg },
        { provide: UtilsIntentService, useValue: mockUtils },
        { provide: 'BullQueue_solana_intent', useValue: mockQueue },
      ],
    }).compile()

    indexer = module.get(SolanaIndexerService)
    await indexer.onModuleInit()
  })

  it('adds queue job & updates model when a new intent arrives', async () => {
    const fakeAccountId = new PublicKey('B6cg8ixxxxxxx11111111111111111111111111111')
    const fakeAccountInfo = { data: Buffer.alloc(8) } as any // only discriminator checked

    await programAccountChangeCallback({ accountId: fakeAccountId, accountInfo: fakeAccountInfo })

    expect(mockUtils.updateIntentModel).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: fakeIntent,
        status: 'PENDING',
        vmType: 'SVM',
      }),
    )

    expect(mockQueue.add).toHaveBeenCalledWith(
      QUEUES.SOLANA_INTENT.jobs.feasable_intent,
      fakeIntent.hash,
      expect.objectContaining({ jobId: fakeIntent.hash }),
    )
  })

  it('removes the listener on module destroy', async () => {
    indexer.onModuleDestroy()
    expect(mockRemoveListener).toHaveBeenCalledWith(42)
  })
})
