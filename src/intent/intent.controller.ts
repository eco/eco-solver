import { Controller } from '@nestjs/common'
import { WatchCreateIntentService } from '../watch/intent/watch-create-intent.service'
import { ValidateIntentService } from './validate-intent.service'
import { IntentOperationLogger } from '@/common/logging/loggers'

@Controller('intent')
export class IntentSourceController {
  private logger = new IntentOperationLogger('IntentSourceController')
  constructor(
    private readonly watchIntentService: WatchCreateIntentService,
    private readonly validateService: ValidateIntentService,
  ) {}

  // @Get()
  // @LogOperation('fake_intent_creation', IntentOperationLogger)
  // async fakeIntent() {
  //   const intent = intentPreprod
  //   const si: IntentSource = {
  //     network: intent[0].sourceNetwork as Network,
  //     chainID: Number(intent[0].sourceChainID),
  //     sourceAddress: '0x',
  //     inbox: '0x',
  //     tokens: [],
  //     provers: [],
  //   }

  //   return await this.watchIntentService.addJob(si)(intent)
  //   // return this.wsService.addJob(Network.OPT_SEPOLIA)(intent)
  // }

  // @Get('process')
  // @LogOperation('fake_intent_validation', IntentOperationLogger)
  // async fakeProcess(@LogContext hash: Hex = '0xe42305a292d4df6805f686b2d575b01bfcef35f22675a82aacffacb2122b890f') {
  //   return await this.validateService.validateIntent(hash)
  //   //  await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.process_intent, hash, {
  //   //   jobId: hash,
  //   // })
  // }
}
