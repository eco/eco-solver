import { EcoConfigService } from '@libs/solver-config'
import { EcoTester } from '@eco-solver/common/test-utils/eco-tester/eco-tester'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Logger } from '@nestjs/common'
import { SignerKmsService } from '@eco-solver/sign/signer-kms.service'

const logger = new Logger('KernelAccountClientServiceSpec')

let $: EcoTester
let kernelAccountClientService: KernelAccountClientService

async function getClient(id: number) {
  return {
    kernelAccount: { address: '0xMockKernelAddress' },
    estimateGas: jest.fn().mockResolvedValue(100000n),
    getGasPrice: jest.fn().mockResolvedValue(12n),
  } as any
}

describe('KernelAccountClientService', () => {
  beforeAll(async () => {
    const mockSource = {
      getConfig: () => ({
        rpcs: {
          keys: {
            '0x1234': '0x1234',
          },
        },
        eth: {
          pollingInterval: 1000,
        },
        chainID: 1,
      }),
    }

    $ = EcoTester.setupTestFor(KernelAccountClientService)
      .withProviders([
        {
          provide: EcoConfigService,
          useValue: new EcoConfigService([mockSource as any]),
        },
        {
          provide: SignerKmsService,
          useValue: {
            getAccount: () => ({ address: '0x826b0B7f1A84a592e1Aa63BC59204F55b81D398d' }),
          },
        },
      ])
      .withMocks([])

    kernelAccountClientService = await $.init()
    kernelAccountClientService.getClient = getClient
  })

  it('should estimate gas for Kernel executeBatch', async () => {
    const result = await kernelAccountClientService.estimateGasForKernelExecution(1, [
      { to: '0x8c182a808f75a29c0f02d4ba80ab236ab01c0acd', data: '0xdeadbeef', value: 0n },
    ])

    expect(result.response?.gasEstimate).toBe(100000n)
    expect(result.response?.gasPrice).toBe(12n)
  })
})
