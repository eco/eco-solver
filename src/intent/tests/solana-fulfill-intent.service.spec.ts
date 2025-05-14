import { Test } from '@nestjs/testing'
import { SolanaFulfillService } from '@/intent/solana-fulfill-intent.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Keypair } from '@solana/web3.js'
import { sendTransactionWithRetry } from '@/solana/utils'
import { IntentDataModel } from '../schemas/intent-data.schema'

jest.mock('@/solana/utils', () => ({
  sendTransactionWithRetry: jest.fn(),
}))

jest.mock('@solana/web3.js', () => {
  const real = jest.requireActual('@solana/web3.js')
  return {
    ...real,
    Connection: jest.fn().mockImplementation(() => ({
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: 'abc',
        lastValidBlockHeight: 99,
      }),
      getBlockHeight: jest.fn().mockResolvedValue(90),
      confirmTransaction: jest.fn().mockResolvedValue(undefined),
      getParsedTransaction: jest.fn().mockResolvedValue({
        meta: { fee: 0, err: null },
        slot: 1,
        transaction: { message: { recentBlockhash: 'abc' } },
      }),
      sendTransaction: jest.fn().mockResolvedValue('sig'),
    })),
  }
})

describe('SolanaFulfillService', () => {
  let svc: SolanaFulfillService
  let utils: jest.Mocked<UtilsIntentService>

  const intentHash = '0xaaaa'
  const dummySimulation = {
    solverLamports: 0n,
    solverTokenAmounts: {},
    lamportsOut: 0n,
    tokenOut: {},
  } as any

  beforeEach(async () => {
    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        SolanaFulfillService,
        {
          provide: UtilsIntentService,
          useValue: { getIntentProcessData: jest.fn(), updateIntentModel: jest.fn() },
        },
        {
          provide: EcoConfigService,
          useValue: {
            getSolanaConfig: () => ({
              rpc_url: 'https://api.mainnet-beta.solana.com',
              router_program_id: '',
            }),
          },
        },
        { provide: 'SOLVER_SOLANA_KEYPAIR', useValue: Keypair.generate() },
      ],
    }).compile()

    svc = module.get(SolanaFulfillService)
    utils = module.get(UtilsIntentService) as any
  })

  it('throws when sendTransactionWithRetry returns undefined', async () => {
    ;(sendTransactionWithRetry as jest.Mock).mockResolvedValueOnce(undefined)
    utils.getIntentProcessData.mockResolvedValue({
      model: {
        intent: {
          hash: '0x0',
          logIndex: 0,
          route: {
            source: 0n,
            destination: 0n,
            salt: '0x0',
            inbox: '0x0',
            calls: [],
            tokens: [],
          },
          reward: {
            creator: '0x0',
            prover: '0x0',
            nativeValue: 0n,
            deadline: 0n,
            tokens: [],
          },
        } as IntentDataModel,
        status: '',
      },
    } as any)

    await expect(svc.fulfill({ intentHash, simulationResult: dummySimulation })).rejects.toThrow(
      'Failed to send a fulfill transaction',
    )
  })

  it('updates DB & returns signature on success', async () => {
    ;(sendTransactionWithRetry as jest.Mock).mockResolvedValueOnce('sig')
    utils.getIntentProcessData.mockResolvedValue({
      model: {
        intent: {
          hash: '0x0',
          logIndex: 0,
          route: {
            source: 0n,
            destination: 0n,
            salt: '0x0',
            inbox: '0x0',
            calls: [],
            tokens: [],
          },
          reward: {
            creator: '0x0',
            prover: '0x0',
            nativeValue: 0n,
            deadline: 0n,
            tokens: [],
          },
        } as IntentDataModel,
        status: '',
      },
    } as any)

    const sig = await svc.fulfill({ intentHash, simulationResult: dummySimulation })

    expect(sig).toBe('sig')
    expect(utils.updateIntentModel).toHaveBeenCalled()
  })
})
