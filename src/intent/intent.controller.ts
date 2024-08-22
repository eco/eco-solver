import { Controller, Get } from '@nestjs/common'
import { WebsocketIntentService } from './websocket-intent.service'
import { getRandomString } from '../common/utils/strings'
import { Network } from 'alchemy-sdk'
import { ValidateIntentService } from './validate-intent.service'

@Controller('intent')
export class SourceIntentController {
  constructor(
    private readonly wsService: WebsocketIntentService,
    private readonly validateService: ValidateIntentService,
  ) {}

  @Get()
  fakeIntent() {
    // const erc = ERC20__factory.createInterface()
    // const tx = erc.parseTransaction({ data: '0xa9059cbb000000000000000000000000cd80b973e7cbb93c21cc5ac0a5f45d12a32582aa00000000000000000000000000000000000000000000000000000000000004d2' })
    // console.log('tx: ', tx)

    return this.wsService.addJob({
      network: intent.sourceNetwork, chainID: intent.sourceChainID,
      sourceAddress: '',
      tokens: []
    })(intent)
    // return this.wsService.addJob(Network.OPT_SEPOLIA)(intent)
  }

  @Get('process')
  async fakeProcess() {
    const hash = '0x341c195547c8becccdcb8390a2fd8bc416316224d7d4e1938137d45829407044'
    return await this.validateService.validateIntent(hash)
    //  await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.process_intent, hash, {
    //   jobId: hash,
    // })
  }
}

const intent = {
  blockNumber: 14672041,
  blockHash: '0x8bc8fd6c46154a8b58b14ebfeb0a11e912eeb590b12a21d56a003269f8ed07f4',
  transactionIndex: 1,
  removed: false,
  address: '0x6B79cD3fE2Eccd3a69c52e621a81d26E75983787',
  sourceNetwork: Network.OPT_SEPOLIA,
  sourceChainID: 11155420,
  data: '0x00000000000000000000000013e12300ad48e11df1b2d7b0f4d276e138cc566d00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000020059e4a58f9021a6f643125c738ee2b329b2233465b89bb3bcb4f22e3774c562310000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ab1d243b07e99c91de9e4b80dfc2b07a8332a2f7000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000cd80b973e7cbb93c21cc5ac0a5f45d12a32582aa00000000000000000000000000000000000000000000000000000000000004d200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000d2d1162c689179e8ba7a3b936f80a010a0b5cf000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000004d2',
  topics: [
    '0x4d57d71884135619aa0097f5e665cc0257fcf37b35433f4b554f57a182e77416',
    '0x341c195547c8becccdcb8390a2fd8bc416316224d7d4e1938137d45829407044',
    '0x0000000000000000000000000000000000000000000000000000000000014a34',
    '0x000000000000000000000000000000000000000000000000000000006696ab0a',
  ],
  transactionHash: '0x' + getRandomString(),
  logIndex: 2,
}
