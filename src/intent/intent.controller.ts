import { Controller, Get } from '@nestjs/common'
import { WatchCreateIntentService } from '../watch/intent/watch-create-intent.service'
import { Network } from '@/common/alchemy/network'
import { ValidateIntentService } from './validate-intent.service'
import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { IntentSource } from '../eco-configs/eco-config.types'
import { IntentCreatedLog } from '../contracts'

@Controller('intent')
export class IntentSourceController {
  private logger = new Logger(IntentSourceController.name)
  constructor(
    private readonly watchIntentService: WatchCreateIntentService,
    private readonly validateService: ValidateIntentService,
  ) {}

  @Get()
  async fakeIntent() {
    const intent = intentPreprod
    const si: IntentSource = {
      network: intent[0].sourceNetwork as Network,
      chainID: Number(intent[0].sourceChainID),
      sourceAddress: '0x',
      inbox: '0x',
      tokens: [],
      provers: [],
    }
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `fakeIntent intent`,
        properties: {
          si: si,
        },
      }),
    )

    return await this.watchIntentService.addJob(si)(intent)
    // return this.wsService.addJob(Network.OPT_SEPOLIA)(intent)
  }

  @Get('process')
  async fakeProcess() {
    const hash = '0xe42305a292d4df6805f686b2d575b01bfcef35f22675a82aacffacb2122b890f'
    return await this.validateService.validateIntent(hash)
    //  await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.process_intent, hash, {
    //   jobId: hash,
    // })
  }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const intentSepolia = [
  {
    blockNumber: 17962391,
    blockHash: '0xee4e51400ef5a10f3320acdd3185b81be256f72b38ce58e30e8bfc82bebf1fdf',
    transactionIndex: 5,
    removed: false,
    address: '0xc135737f2a05b0f65c33dab7c60e63e3e2008c6c',
    data: '0x000000000000000000000000448729e46c442b55c43218c6db91c4633d36dfc000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000002203b1577c45a6844d79e91e8aa32364e57ef8eb2885b839412eaaaca9e0b39e0900000000000000000000000007c6a40f388dfd4cf1a8456978c55227f3e968ab70000000000000000000000000000000000000000000000000',
    topics: [
      '0x653c41cbe9402a28b206076ac6e316307a1ef8f76f247c1da9fdc2f50a405819',
      '0xbea19c3652e996e07102c0a264fc378fd7c5a3d7cf5ee9094c82fc17ad9b584b',
      '0x0000000000000000000000000000000000000000000000000000000000014a34',
      '0x0000000000000000000000000000000000000000000000000000000066fb14e6',
    ],
    transactionHash: '0xa3927752f5954956a8bdb232c05fb32ed43ce73fc57fad33575f6de488a6f819',
    logIndex: 54,
    sourceNetwork: 'opt-sepolia' as Network,
    sourceChainID: 11155420,
  } as unknown as IntentCreatedLog,
  {
    blockNumber: 17962148,
    blockHash: '0xe571be8cc3d3d5e7125e1adf34949c8c5ed79212619986e08183e7194215f9ef',
    transactionIndex: 3,
    removed: false,
    address: '0xc135737f2a05b0f65c33dab7c60e63e3e2008c6c',
    data: '0x000000000000000000000000448729e46c442b55c43218c6db91c4633d36dfc000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220d6d2d4c7071ecb71efe5d347b841cfe160f86eacc65af977178318d92cd2665c000000000000000000000000b31fd140643dbd868e7732eecb5ac9c859348eb90000000000000000000000000000000000000000000000000',
    topics: [
      '0x653c41cbe9402a28b206076ac6e316307a1ef8f76f247c1da9fdc2f50a405819',
      '0x59f1406ab59d835cdbb5bd0bee0338fa1a1192537d6edc3cde81a783004fae55',
      '0x0000000000000000000000000000000000000000000000000000000000014a34',
      '0x0000000000000000000000000000000000000000000000000000000066fb1300',
    ],
    transactionHash: '0x3a9bd095198503ee742d40d6e53ecd51fca6bd0898a9519f253f4d41696f9da6',
    logIndex: 10,
    sourceNetwork: 'opt-sepolia' as Network,
    sourceChainID: 11155420,
  } as unknown as IntentCreatedLog,
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const intentMainnet = [
  {
    blockNumber: 20220263,
    blockHash: '0x97e812234007ea7ec5fd148303eba2f4a66eee559a7513ee05463d1340e1da0f',
    transactionIndex: 37,
    removed: false,
    address: '0x13727384eb72ee4de1332634957f5473e5f1d52a',
    data: '0x00000000000000000000000035395d96fcb26d416fd5593cadec099cf6b2900700000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000002207b518f342018b98c52a34a7ef70864fb17154c485d3e0e2514804e6127347baf00000000000000000000000099b07ff401e2c73826f3043adab2ef37e53d4f23000000000000000000000000000000000000000000000000000000000000000100000000000000000000000094b008aa00579c1307b0ef2c499ad98a8ce58e58000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000035395d96fcb26d416fd5593cadec099cf6b2900700000000000000000000000000000000000000000000000000000000001240fd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000001240fd',
    topics: [
      '0x653c41cbe9402a28b206076ac6e316307a1ef8f76f247c1da9fdc2f50a405819',
      '0x0ad607c1c6b1257f303fd7df4eb3b2b34f6cbf44bea7ee472c80d09d3a78ec6c',
      '0x000000000000000000000000000000000000000000000000000000000000000a',
      '0x000000000000000000000000000000000000000000000000000000006705e4a9',
    ],
    transactionHash: '0x9fc8563025960dc7c5f2352581370bed98938fea61f156bddd94b7c636a712c0',
    logIndex: 166,
    sourceNetwork: 'base-mainnet' as Network,
    sourceChainID: 8453,
  } as unknown as IntentCreatedLog,
  {
    blockNumber: 20220263,
    blockHash: '0x97e812234007ea7ec5fd148303eba2f4a66eee559a7513ee05463d1340e1da0f',
    transactionIndex: 37,
    removed: false,
    address: '0x13727384eb72ee4de1332634957f5473e5f1d52a',
    data: '0x00000000000000000000000035395d96fcb26d416fd5593cadec099cf6b2900700000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220e7b20d93a3118925da179090f052bc426d516e46b502f8ca98569063535f018600000000000000000000000099b07ff401e2c73826f3043adab2ef37e53d4f23000000000000000000000000000000000000000000000000000000000000000100000000000000000000000094b008aa00579c1307b0ef2c499ad98a8ce58e58000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000035395d96fcb26d416fd5593cadec099cf6b2900700000000000000000000000000000000000000000000000000000000003b90e3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000d9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000003b90e3',
    topics: [
      '0x653c41cbe9402a28b206076ac6e316307a1ef8f76f247c1da9fdc2f50a405819',
      '0xae7027bea4a9a181da07e4bfcc8def155d49e57fec3319cfcbfc729828e995a9',
      '0x000000000000000000000000000000000000000000000000000000000000000a',
      '0x000000000000000000000000000000000000000000000000000000006705e4a9',
    ],
    transactionHash: '0x9fc8563025960dc7c5f2352581370bed98938fea61f156bddd94b7c636a712c0',
    logIndex: 170,
    sourceNetwork: 'base-mainnet' as Network,
    sourceChainID: 8453,
  } as unknown as IntentCreatedLog,
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const intentPreprod = [
  {
    eventName: 'IntentCreated',
    args: {
      _hash: '0x52b423ed4c168c87c01c74b4b029b43d6c30f28d9c243302a7b2a328ea077ad2',
      _destinationChain: 8453n,
      _expiryTime: 1729177919n,
      _creator: '0xE105537f4Cc3474f62A10d6666CA99C472df23Ce',
      _targets: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
      _data: [
        '0xa9059cbb000000000000000000000000e105537f4cc3474f62a10d6666ca99c472df23ce00000000000000000000000000000000000000000000000000000000000186a0',
      ],
      _rewardTokens: ['0x7F5c764cBc14f9669B88837ca1490cCa17c31607'],
      _rewardAmounts: [100000n],
      nonce: '0xab2e7c93b77d291ccc2bb5e5e387766aa4ff230cfccbafafca668e41e7600161',
      _prover: '0x99b07fF401E2c73826f3043AdaB2ef37e53d4f23',
    },
    address: '0x6d9eede368621f173e5c93384cfccbfee19f9609',
    blockHash: '0xc3d3c86c06e97602532e5adc6e3368c797e0c6adb7c13d5d2f314c63535245cf',
    blockNumber: 126184775n,
    data: '0x000000000000000000000000e105537f4cc3474f62a10d6666ca99c472df23ce00000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220ab2e7c93b77d291ccc2bb5e5e387766aa4ff230cfccbafafca668e41e760016100000000000000000000000099b07ff401e2c73826f3043adab2ef37e53d4f230000000000000000000000000000000000000000000000000000000000000001000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000e105537f4cc3474f62a10d6666ca99c472df23ce00000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000186a0',
    logIndex: 38,
    removed: false,
    topics: [
      '0x653c41cbe9402a28b206076ac6e316307a1ef8f76f247c1da9fdc2f50a405819',
      '0x52b423ed4c168c87c01c74b4b029b43d6c30f28d9c243302a7b2a328ea077ad2',
      '0x0000000000000000000000000000000000000000000000000000000000002105',
      '0x000000000000000000000000000000000000000000000000000000006711293f',
    ],
    transactionHash: '0xdd34f28a776b334e108c4f2f7fce8172706f91cd6ceae6f3cdd982af90cb72f5',
    transactionIndex: 15,
    sourceChainID: 10,
    sourceNetwork: 'opt-mainnet',
    // "watchintent-0xdd34f28a776b334e108c4f2f7fce8172706f91cd6ceae6f3cdd982af90cb72f5-38"
  } as unknown as IntentCreatedLog,
  {
    eventName: 'IntentCreated',
    args: {
      _hash: '0x5142534d8af59ce2916fc2a4c6b5767b10704befab006550905b343d05a71a14',
      _destinationChain: '8453',
      _expiryTime: '1729184897',
      _creator: '0xE105537f4Cc3474f62A10d6666CA99C472df23Ce',
      _targets: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
      _data: [
        '0xa9059cbb000000000000000000000000e105537f4cc3474f62a10d6666ca99c472df23ce0000000000000000000000000000000000000000000000000000000000004e20',
      ],
      _rewardTokens: ['0x7F5c764cBc14f9669B88837ca1490cCa17c31607'],
      _rewardAmounts: ['20000'],
      nonce: '0xd08d78535e1b1ad9259940cf4a5f412310e10951b446c8c9ef99bde6ecb06e83',
      _prover: '0x99b07fF401E2c73826f3043AdaB2ef37e53d4f23',
    },
    address: '0x6d9eede368621f173e5c93384cfccbfee19f9609',
    topics: [
      '0x653c41cbe9402a28b206076ac6e316307a1ef8f76f247c1da9fdc2f50a405819',
      '0x5142534d8af59ce2916fc2a4c6b5767b10704befab006550905b343d05a71a14',
      '0x0000000000000000000000000000000000000000000000000000000000002105',
      '0x0000000000000000000000000000000000000000000000000000000067114481',
    ],
    data: '0x000000000000000000000000e105537f4cc3474f62a10d6666ca99c472df23ce00000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220d08d78535e1b1ad9259940cf4a5f412310e10951b446c8c9ef99bde6ecb06e8300000000000000000000000099b07ff401e2c73826f3043adab2ef37e53d4f230000000000000000000000000000000000000000000000000000000000000001000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000e105537f4cc3474f62a10d6666ca99c472df23ce0000000000000000000000000000000000000000000000000000000000004e200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c3160700000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000004e20',
    blockNumber: '126188264',
    transactionHash: '0x18a87f736d686808de36edae5788d1743be2ec61cfad327fb311856354815af0',
    transactionIndex: 9,
    blockHash: '0xbb4e270bd6de43134a0983198069a98b0f4c44987307ecc5c715bd091daea47b',
    logIndex: 35,
    removed: false,
    sourceNetwork: 'opt-mainnet',
    sourceChainID: 10,
  } as unknown as IntentCreatedLog,
]
