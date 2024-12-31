import { QUEUES } from '@/common/redis/constants'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { Job, Queue } from 'bullmq'

describe('WatchFulfillmentService', () => {
  beforeEach(async () => {
  })

  describe('on lifecycle', () => {
    describe('on startup', () => {
      it('should subscribe to nothing if no solvers', async () => {
      })

      it('should subscribe to all solvers', async () => {
      })
    })

    describe('on destroy', () => {
      it('should unsubscribe to nothing if no solvers', async () => {
       
      })

      it('should unsubscribe to all solvers', async () => {
        
      })
    })
  })
})